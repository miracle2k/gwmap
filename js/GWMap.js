/*
 * Import code from additional javascript files.
 */
 
document.write('<script src="../js/FlatProjection.js" type="text/javascript"></script>');

/*
 * The maps we support are defined in a text file, along with some basic
 * information about each (e.g. min/max zoom levels, size, coordinate offsets
 * etc) that we need. 
 * We will start loading this file right away, and no map object will ever be 
 * completely created until this was successful .
 */

// This will store the map database (as an arary) after it has been loaded
available_maps = false; 

// Database status. You can't create a map unless _LOADED is True. If you try, the map will
// not show until the database is available. If _FAILED is True, creating a map object will
// immediately result in failure.
var MAP_INDEX_LOADED = false;
var MAP_INDEX_FAILED = false;

// Where to find the map database file. Change if the default directory layout is not used.
const MAP_INDEX_URL = '../maps/maps.txt'; 

// Start loading the database NOW
initialize_map_index();
function initialize_map_index() { if (!MAP_INDEX_LOADED) GDownloadUrl(MAP_INDEX_URL, parse_map_index); }

/*
 * Global variable that points to the function that is used to put together the
 * URLs we use to retrieve the map tiles from. The GWMap class assigns this
 * to tileLayer.getTileUrl when needed by the Google Maps API.
 * We provide our own implementation(s) for this function, but users who wish
 * to use their own map graphics could possible intercept here.
 */
 
var __getTileUrlFunction = GWMapDefaultGetTileUrlImpl;

function GWMapDefaultGetTileUrlImpl(a,b,whichMap)
{
    // return the requested one
    return '../maps/'+whichMap+'/'+b+'/'+(a.x)+'_'+(a.y)+'.jpg';
}

/*
 * Central class.
 */

function GWMap(attachTo, whichMap, zoom, posX, posY)
{      
    /*********************************************************************
     * Class methods
     ********************************************************************/
     
    this.waitForDatabase = function(callback, parameters)
    {             
        // check status of map database. if we are still loading, wait until that is completed (and
        // check in 50 msec intervals). If we already know map loading failed, don't wait any longer.
        // See http://west-wind.com/WebLog/posts/5033.aspx on how to use SetTimeout() within class methods.
        if (MAP_INDEX_FAILED) { alert('Database not available - cannot create map.'); return false; }
        if (!MAP_INDEX_LOADED) {                    
            self = this;  
            window.setTimeout(function() { self['waitForDatabase'].apply(self, [callback, parameters]); }, 50);
            return false;
        }
        // map data is loaded, return
        else {
          self[callback].apply(self, parameters);
        }
    }

    this.createMap = function(attachTo, whichMap, zoom, posX, posY)
    {        
        if (!MAP_INDEX_LOADED)       
          this.waitForDatabase('createMap', [attachTo, whichMap, zoom, posX, posY]);
        
        // make sure the requested map is valid     
        if (available_maps[whichMap] === undefined) return false;
        mapdata = available_maps[whichMap];
        
        // create GTileLayer array that will represent the map images;
        var tileLayers = [new GTileLayer(
            // use an empty copyright collection - instead we will later
            // overwrite getCopyright() to display a copyright notice.
            new GCopyrightCollection("Guild Wars"),
            // The zoom level range we support. Low bound is always 0.        
            0, mapdata['max-zoom']
        )];
        // the copyright notice, should indicate who created the map material (ArenaNet?!)
        tileLayers[0].getCopyright = function(a,b) {
            return {prefix:"", copyrightTexts:['(c) ArenaNet']};
        }
        // define a function to retrieve the tile images whenever needed
        tileLayers[0].getTileUrl = function(a,b) { return __getTileUrlFunction(a,b,whichMap); };

        // create our own map type
        this.MapPxPerLon = 256;  // always 256, for now
        this.MapWidth = mapdata['tile-counts'][mapdata['default-zoom']]['x']*this.MapPxPerLon;
        this.MapHeight = mapdata['tile-counts'][mapdata['default-zoom']]['y']*this.MapPxPerLon;
        var gwMapType = new GMapType(
            // the GTileLayer array we created earlier
            tileLayers,
            // Use our own flat projection
            new FlatProjection(this.MapWidth, this.MapHeight, this.MapPxPerLon, 
              mapdata['default-zoom'], mapdata['max-zoom']),
            // name of the map type (test: will this really be appended to copyright notice?)
            "Custom",
            // use default error message for unavailable tiles
            {errorMessage:_mMapError}
        );

        // finally, create the google map object
        this.mapObject = new GMap2(document.getElementById(attachTo));
        // add some controls
        this.mapObject.addControl(new GScaleControl());
        this.mapObject.addControl(new GLargeMapControl());
        // add our own custom map type and remove the default ones
        this.mapObject.removeMapType(G_NORMAL_MAP);
        this.mapObject.removeMapType(G_SATELLITE_MAP);
        this.mapObject.removeMapType(G_HYBRID_MAP);
        this.mapObject.addMapType(gwMapType);
        this.mapObject.getContainer().style.backgroundColor='#000';
        // set initial position. if no coordinates where passed, use center
        // if not zoom is given, use default
        if (!posX || !posY) { posX = (this.MapWidth/this.MapPxPerLon)/2; posY = (this.MapHeight/this.MapPxPerLon)/2; }
        if (zoom == undefined) zoom = mapdata['default-zoom'];
        this.mapObject.setCenter(new GLatLng(posY,posX), zoom, gwMapType);  
    }   

    this.indicatePosition = function(posX, posY) 
    {        
        if (!MAP_INDEX_LOADED) {      
          this.waitForDatabase('indicatePosition', [posX, posY]);
          return false;
        }   
        // create our "tiny" marker icon
        var icon = new GIcon();
        icon.image = "../img/marker.png";
        icon.shadow = "../img/marker.png";
        icon.iconSize = new GSize(20, 20);
        icon.shadowSize = new GSize(20, 20);
        icon.iconAnchor = new GPoint(10, 10);
        icon.infoWindowAnchor = new GPoint(5, 1);

        // add marker
        marker = new GMarker(new GPoint(posX,posY), icon);
        this.mapObject.addOverlay(marker);      
    }
    
    /*********************************************************************
     * Actual constructor code
     ********************************************************************/
    
    // create the map object. we need a separate function for this, as we have to
    // wait for the map database to be loaded, and that requires recusion.
    this.createMap(attachTo, whichMap, zoom, posX, posY);
}

/*
 * Parse the map database
 */
function parse_map_index(data, responseCode)
{
    function __failed(msg) { MAP_INDEX_FAILED = true; /*alert(msg);*/ return false; }

    // check for valid response
    if (!data || responseCode != 200) {
        MAP_INDEX_FAILED = true;
    }
    else {
        available_maps = new Array();
        lines = data.split("\n");
        for(key in lines) 
        {
            // if this line is a comment, ignore 
            map = lines[key].replace(/^\s*|\s*$/g,"");
            if (map[0]==';') continue;
            // split into fields, format is:
            // map name|zoom level count|default zoom (0-max)|tile count x/y zoom 0|tile count x/y zoom 1|...  
            _marr = map.split('|');
            available_maps[_marr[0]] = new Array();
            available_maps[_marr[0]]['max-zoom'] = parseInt(_marr[1])-1;
            available_maps[_marr[0]]['default-zoom'] = parseInt(_marr[2]);
            available_maps[_marr[0]]['tile-counts'] = new Array();
            for(i=0;i<parseInt(_marr[1]);i++)
            {
                coords = _marr[i+3].split(';'); _x = coords[0]; _y = coords[1];
                // make sure we have valid data
                _x = parseInt(_x); _y = parseInt(_y);
                if (!_x | !_y) return __failed("failed to read tile count for zoom level "+i+" of map '"+_marr[0]+"'");
                available_maps[_marr[0]]['tile-counts'][i] = new Array();
                available_maps[_marr[0]]['tile-counts'][i]['x'] = _x;
                available_maps[_marr[0]]['tile-counts'][i]['y'] = _y;
            }
        }
        // everything went fine
        MAP_INDEX_LOADED = true;
    }
}

/*
 * For debugging.
 */
function log(message) {
    if (!log.window_ || log.window_.closed) {
        var win = window.open("", null, "width=400,height=200," +
                              "scrollbars=yes,resizable=yes,status=no," +
                              "location=no,menubar=no,toolbar=no");
        if (!win) return;
        var doc = win.document;
        doc.write("<html><head><title>Debug Log</title></head>" +
                  "<body></body></html>");
        doc.close();
        log.window_ = win;
    }
    var logLine = log.window_.document.createElement("div");
    logLine.appendChild(log.window_.document.createTextNode(message));
    log.window_.document.body.appendChild(logLine);
}

/*
 * Quick access to commonly used map functionality.
 */

function gwmap_indicate_position(whichMap, posX, posY, width, height)
{
    // use default values for width and height of not passed
    if (!width) width='300px';
    if (!height) height='300px';
    // add timestamp to div id to make sure we have a unique identifier
    var divId = 'gwmap_' + new Date().getTime();
    // output the div we use to display the map
    document.write('<div id="'+divId+'" style="width: '+width+'; height: '+height+';"></div>');
    // create map object and attach
    mapObj = new GWMap(divId, whichMap, 3, posX, posY);
    mapObj.indicatePosition(posX, posY);
}