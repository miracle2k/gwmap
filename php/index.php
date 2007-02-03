<?php
    /*
     * Some default settings.
     */
    DEFINE('DEFAULT_WIDTH',       400);  // used if no value is passed
    DEFINE('DEFAULT_HEIGHT',      400);  // used if no value is passed
    DEFINE('TILE_SIZE',           256);
    DEFINE('MAPDATA_DIR',         '../maps');
    DEFINE('IMG_DIR',             '../img'); 
     
    /*
     * Handle parameters.
     */
    function loadOption($name, $default=false) {
        if (isset($_REQUEST[$name])) return $_REQUEST[$name];
        else if ($default) return $default;
        else die("option \"$name\" is required but missing.");
    }
    $positionX = loadOption('x');
    $positionY = loadOption('y');
    $outputWidth = loadOption('w', DEFAULT_WIDTH);
    $outputHeight = loadOption('h', DEFAULT_HEIGHT);
    $zoomLevel = intval(loadOption('z', -1));
    $whichMap = loadOption('map');
    
    /*
     * Open the map index file, and get all the neccessary data
     */
    $available_maps = array();
    $_mapdata = file(MAPDATA_DIR.'/maps.txt');
    foreach($_mapdata as $_map)
    {
        // if this line is a comment, ignore 
        $_map = trim($_map);  
        if ($_map[0]==';') continue;        
        // split into fields, format is:
        // map name|zoom level count|default zoom (0-max)|tile count x/y zoom 0|tile count x/y zoom 1|...  
        $_marr = split('\|', $_map); 
        $available_maps[$_marr[0]] = array(
          'max-zoom' => intval($_marr[1])-1,
          'default-zoom' => intval($_marr[2])          
        );
        for($i=0;$i<intval($_marr[1]);$i++)
        {
            list($_x, $_y) = split(';', $_marr[$i+3]);
            // make sure we have a valid data
            $_x = intval($_x); $_y = intval($_y);
            if (!$_x | !$_y) die("failed to read tile count for zoom level '$i' of map '{$_marr[0]}'.");        
            
            $available_maps[$_marr[0]]['tile-counts'][$i] = array('x' => $_x, 'y' => $_y); 
        }        
    }
    
    // make sure the map requested by the user is valid
    if (!isset($available_maps[$whichMap]))
      die("'$whichMap' is not a valid map name.");
    // if there no zoom level was passed, use the default one
    if ($zoomLevel == -1) $zoomLevel = $available_maps[$whichMap]['default-zoom'];
    // make sure the requested zoom level is valid
    if (!isset($available_maps[$whichMap]['tile-counts'][$zoomLevel]))
      die("A zoom level of $zoomLevel is not valid for '$whichMap'.");
      
    /*
     * adjust requested position:
     *    # +1/+1, because it is zero-, but our calculations 1-based
     *    # for each zoom level modify position by factor 2. On the default 
     *      zoom level, coordinates = pixels
     */
    $positionX += 1; $positionY += 1;
    $positionX = $positionX / pow(2, $available_maps[$whichMap]['default-zoom']-$zoomLevel);
    $positionY = $positionY / pow(2, $available_maps[$whichMap]['default-zoom']-$zoomLevel);
    
    /*
     * Calculate some positions / indices we will need to put  the map together.
     */
    function pixelToTileIndex($pos)
    {
        return floor(($pos-1) / TILE_SIZE);    
    }
    function tileIndexToPixel($tile)
    {
        return $tile*TILE_SIZE;
    }
    
    // if the requested image size is larger than the actual imagery at this zoom level,
    // we'll put a block border around it. calculate the offest now
    $imageryWidth = tileIndexToPixel($available_maps[$whichMap]['tile-counts'][$zoomLevel]['x']+1);
    $imageryHeight = tileIndexToPixel($available_maps[$whichMap]['tile-counts'][$zoomLevel]['y']+1);
    $offset_x = max(0, ($outputWidth-$imageryWidth)/2);
    $offset_y = max(0, ($outputHeight-$imageryHeight)/2);
    // bounds of the current map in pixels
    $minX = 1; $minY = 1; $maxX = $imageryWidth;  $maxY = $imageryHeight;
    // center the requested point in the view:
    //  * XRight/YBottom get -1 - this is because with a tile size of 256, we can never really "center" a 
    //      pixel. Tbus we have to make sure our rect has exactly the right size, or we will have problems later on.
    //  * if the imagery is too small for the requested size, we do use the imagery boundaries as a center right away.
    //      If we don't take care of this now, we'd have to deal with it later at some point. 
    $mapXLeftPixel = floor($positionX - (min($imageryWidth, $outputWidth)/2));
    $mapYTopPixel = floor($positionY - (min($imageryHeight, $outputHeight)/2));
    $mapXRightPixel = floor($positionX + (min($imageryWidth, $outputWidth)/2))-1;
    $mapYBottomPixel = floor($positionY + (min($imageryHeight, $outputHeight)/2))-1; 
    // if we cannot center the point (to close the the edges = negative 
    //   pixel coordinates), we need to extend the view on the other side
    if ($mapXLeftPixel < $minX) { $mapXRightPixel -= ($mapXLeftPixel+$minX); $mapXLeftPixel = $minX; }
    if ($mapYTopPixel < $minY) { $mapYBottomPixel -= ($mapYTopPixel+$minY); $mapYTopPixel = $minY; }
    if ($mapXRightPixel > $maxX) { $mapXLeftPixel -= ($mapXRightPixel-$maxX);  $mapXRightPixel = $maxX; } 
    if ($mapYBottomPixel > $maxY) { $mapYTopPixel -= ($mapYBottomPixel-$maxY);  $mapYBottomPixel = $maxY; }
    // calculate tile index bounds
    $tileXLeftIndex = pixelToTileIndex($mapXLeftPixel);
    $tileYTopIndex = pixelToTileIndex($mapYTopPixel);
    $tileXRightIndex = pixelToTileIndex($mapXRightPixel);    
    $tileYBottomIndex = pixelToTileIndex($mapYBottomPixel);   
    
    /*
     * Create map image and output to browser
     */    
    $mapImg = imagecreatetruecolor($outputWidth, $outputHeight);
    for ($x=$tileXLeftIndex; $x<=$tileXRightIndex; $x++)
    {         
        for ($y=$tileYTopIndex; $y<=$tileYBottomIndex; $y++)
        {
            $filename = dirname(__FILE__).'/'.MAPDATA_DIR."/$whichMap/$zoomLevel/{$x}_{$y}.jpg";
            $tileImg = imagecreatefromjpeg($filename); 
            imagecopy($mapImg, $tileImg, tileIndexToPixel($x)-$mapXLeftPixel+$offset_x, tileIndexToPixel($y)-$mapYTopPixel+$offset_y, 
              0, 0, TILE_SIZE, TILE_SIZE);
            imagedestroy($tileImg);
        }
    }  
    // mark requested position
    $markerImg = imagecreatefrompng(IMG_DIR.'/marker.png'); 
    imagecopy($mapImg, $markerImg, ($offset_x+$positionX-$mapXLeftPixel)-10, ($offset_y+$positionY-$mapYTopPixel)-10, 0, 0, 20, 20);
          
    // send to browser
    header("Content-type: image/png");   
    imagepng($mapImg);    
    imagedestroy($mapImg);   
?>
