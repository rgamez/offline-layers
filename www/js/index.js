'use strict';

/* global L */
/* global ol */
/* global cordova */
/* global _ */

/**
 * Invoke the callback if it's a function
 * @param callback - a function
 */
var doCallback = function(callback) {
    if (typeof callback === 'function') {
        callback();
    }
};

/**
 * Register a function that will be invoked then the page is shown
 * @param callback - a function
 */
var registerOnShow = function(pageId, callback) {
    $(document).on('pagecontainershow', function() {
        var activePage = $('body').pagecontainer('getActivePage');

        if (activePage.attr('id') === pageId) {
            doCallback(callback);
        }
    });
};

/**
 * Create and initialize an openlayers map
 * @param pageId - dom selector for the page where the map is displayed
 * @param domElement - dom selector for the element containig the map
 * @returns a map instance
 */
var createOpenlayersMap = function(pageId, domElement) {
    // Create the base layer
    var osmLayer = new ol.layer.Tile({
      source: new ol.source.OSM({
        attributions: [
          new ol.Attribution({
            html: 'Openlayers | '
          }),
          ol.source.OSM.ATTRIBUTION
        ],
        url: 'http://{a-c}.tile.osm.org/{z}/{x}/{y}.png'
      })
    });

    // Create the map
    var interactions = ol.interaction.defaults({altShiftDragRotate:false, pinchRotate:false});
    var map = new ol.Map({
        layers: [
            osmLayer
        ],
        controls: ol.control.defaults({
            attributionOptions: /** @type {olx.control.AttributionOptions} */ ({
              collapsible: false
            })
        }),
        interactions: interactions,
        target: domElement,
        view: new ol.View({
            center: ol.proj.transform([-3.1803, 55.9362], 'EPSG:4326', 'EPSG:3857'),
            zoom: 13
        })
    });

    // Reset the map then the page changes
    registerOnShow(pageId, function() {
        map.updateSize();
    });

    return map;
};

/**
 * Create and initialize a Leaflet map
 * @param pageId - dom selector for the page where the map is displayed
 * @param domElement - dom selector for the element containig the map
 * @returns a map instance
 */
var createLeafletMap = function(pageId, domElement) {
    // Create the map
    var map = L.map(domElement).setView([55.9362,  -3.1803], 13);

    // Add the base layer
    L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Reset the map then the page changes
    registerOnShow(pageId, function() {
        map.invalidateSize();
    });

    return map;
};

/**
 * Fetch the persistent filesystem of the device
 * @returns a {Promise} that resolves in a {FileSystem} object or
 *          is rejected with an error message
 */
var fetchFileSystem = function() {
    return new Promise(function(resolve, reject) {
        window.requestFileSystem(
            window.LocalFileSystem.PERSISTENT,
            0,
            function(data) {
                resolve(data);
            }, function(reason) {
                reject(reason);
                console.error(reason);
            }
        );
    });
};

/**
 * Fetch a directory in given filesystem
 * @returns a {Promise} that resolves in a {DirectoryEntry} object or
 *          is rejected with an error message
 */
var fetchDirectory = function(fileSystem, directory) {
    return new Promise(function(resolve, reject) {
        fileSystem.root.getDirectory(
            directory,
            {create: false, exclusive: false},
            function(directoryEntry) {
                resolve(directoryEntry);
            },
            function(reason) {
                console.error(reason);
                reject(reason);
            }
        );
    });
};

/**
 * Fetch the list of files in given directoy
 * @param {DirectoryEntry} directoryEntry - a directory entry object
 * @returns a {Promise} that resolves in a list of files or
 *          is rejected with an error message
 */
var listDirectory = function(directoryEntry) {
    return new Promise(function(resolve, reject) {
        var dirReader = directoryEntry.createReader();
        dirReader.readEntries(
            function(entries) {
                resolve(entries);
            },
            function(reason) {
                console.error(reason);
                reject(reason);
            }
        );
    });
};

/**
 * Add a TMS layer to the map
 * @param map - a Leaflet map
 * @param url - a tiles URL
 * @param options - options for the layer
 * @param options.bounds the bounds of the layer
 */
var addLeafletTileLayer = function(map, url, options) {
    options = _.assign(options, { tms: true });

    L.tileLayer(url, options)
        .addTo(map);
};

/**
 * Add a TMS layer to the map
 * @param map - a Leaflet map
 * @param url - a tiles URL
 * @param options - options for the layer
 * @param options.bounds the bounds of the layer
 */
var addOpenLayersTileLayer = function(map, url, options) {
    var extent;
    var transform;

    // Transfor the bounds to mercator projection
    if (options.bounds) {
        transform = ol.proj.getTransform('EPSG:4326', 'EPSG:3857');
        extent = ol.extent.applyTransform(options.bounds, transform);
    }

    var mbTilesLayer = new ol.layer.Tile({
        source: new ol.source.OSM({
            url: url
        }),
        extent: extent
    });

    map.addLayer(mbTilesLayer);
};

var main = function() {
    // Remove the page transitions
    $.mobile.defaultPageTransition = 'none';

    var HTTPMBTiles = cordova.plugins.HTTPMBTiles;

    // Create the two maps in its respective pages
    var olMap = createOpenlayersMap('openlayers-page', 'openlayers-map');
    var leafletMap = createLeafletMap('leaflet-page', 'leaflet-map');

    var startServer = HTTPMBTiles.startServer();
    var fetchMBTiles = fetchFileSystem()
                        .then(_.curry(fetchDirectory)(_, 'tiles'))
                        .then(listDirectory);

    // Wait until the server is ready to add the tiles found
    Promise.all([startServer, fetchMBTiles])
        .then(function(values) {
            var server = values[0];
            var layers = values[1];

            // Add each layer
            _.forEach(layers, function(layer) {
                HTTPMBTiles
                    .addTiles(layer.name, layer.nativeURL.replace('file:///', '/').replace('emulated/', 'sdcard'))
                    .then(function(options) {
                        var leafletOptions = {};
                        var openLayersOptions = {};

                        // Add bounds if any
                        if (options.bounds) {
                            leafletOptions.bounds = [
                                [options.bounds[1], options.bounds[0]],
                                [options.bounds[3], options.bounds[2]]
                            ];
                            openLayersOptions.bounds = options.bounds;
                        }

                        addLeafletTileLayer(
                            leafletMap,
                            'http://localhost:' + server.port + '/' + layer.name + '/{z}/{x}/{y}.png',
                            leafletOptions
                        );

                        addOpenLayersTileLayer(
                            olMap,
                            'http://localhost:' + server.port + '/' + layer.name + '/{z}/{x}/{-y}.png',
                            openLayersOptions
                        );
                    })
                    .catch(function(err) {
                        console.error(err);
                    });

            });
        })
        .catch(function(err) {
            console.error(err);
        });
};

document.addEventListener('deviceready', main, false);
