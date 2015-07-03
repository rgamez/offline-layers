Offline-layers
==============

An experiment of offline layers with the [http-mbtiles](https://github.com/rgamez/cordova-plugin-http-mbtiles/) cordova plugin.


#### Description

On start the ```*.mbtiles``` files found in the ```/storage/sdcard/tiles``` directory are added as layers of a Leaflet and a Openlayers map.

#### Requirements
Apache Cordova >= 3

#### Installation
```
git clone https://github.com/rgamez/offline-layers
cd offline-layers
cordova platform add android
cordova plugin add https://github.com/rgamez/cordova-plugin-http-mbtiles/
cordova run android
```
