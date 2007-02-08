// See http://www.google.com/apis/maps/documentation/reference.html#GProjection 

/**
 * Creates a custom GProjection for flat maps.
 *
 * @classDescription    Creates a custom GProjection for flat maps.
 * @param {Number} width The width in pixels of the map at the specified zoom level.
 * @param {Number} height The height in pixels of the map at the specified zoom level.
 * @param {Number} pixelsPerLon The number of pixels per degree of longitude at the specified zoom level.
 * @param {Number} zoom The zoom level width, height, and pixelsPerLon are set for.
 * @param {Number} maxZoom The maximum zoom level the map will go.
 * @constructor    
 */
function FlatProjection(width,height,pixelsPerLon,zoom,maxZoom)
{
    this.pixelsPerLonDegree = new Array(maxZoom);
    this.tileBounds = new Array(maxZoom);

    width /= Math.pow(2,zoom);
    height /= Math.pow(2,zoom);
    pixelsPerLon /= Math.pow(2,zoom);
    
    for(var i=maxZoom; i>=0; i--)
    {
        this.pixelsPerLonDegree[i] = pixelsPerLon*Math.pow(2,i);
        this.tileBounds[i] = new GPoint(Math.ceil(width*Math.pow(2,i)/256), Math.ceil(height*Math.pow(2,i)/256));
    }
}

FlatProjection.prototype = new GProjection();

FlatProjection.prototype.fromLatLngToPixel = function(point,zoom)
{
    var x = Math.round(point.lng() * this.pixelsPerLonDegree[zoom]);
    var y = Math.round(point.lat() * this.pixelsPerLonDegree[zoom]);
    return new GPoint(x,y);
}

FlatProjection.prototype.fromPixelToLatLng = function(pixel,zoom,unbounded)    
{
    var lng = pixel.x/this.pixelsPerLonDegree[zoom];
    var lat = pixel.y/this.pixelsPerLonDegree[zoom];
    return new GLatLng(lat,lng,true);
}

FlatProjection.prototype.tileCheckRange = function(tile, zoom, tilesize)
{
    if( tile.y<0 || tile.x<0 || tile.y>=this.tileBounds[zoom].y || tile.x>=this.tileBounds[zoom].x )
    {
        return false;
    }
    return true;
}
FlatProjection.prototype.getWrapWidth = function(zoom)
{
    return Number.MAX_VALUE;
}