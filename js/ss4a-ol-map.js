// OpenLayers map for SS4A grant application
//
// Author: Ben  Krepp (bkrepp@ctps.org)

///////////////////////////////////////////////////////////////////////////////
// Stuff for heatmap layer parameters. 
// 'blur' value:
var blur = document.getElementById('blur');
var blur_text = document.getElementById('blur_text');
var blurHandler = function () {
	// Change blur value for _both_ heatmap layers
	brmpo_crashes_heat.setBlur(parseInt(blur.value, 10));
	mapc_non_brmpo_crashes_heat.setBlur(parseInt(blur.value, 10));
	// Report value
	blur_text.innerHTML = blur.value;
};
blur.addEventListener('input', blurHandler);
blur.addEventListener('change', blurHandler);
// 'radius' value:
var radius = document.getElementById('radius');
var radius_text = document.getElementById('radius_text');
var radiusHandler = function () {
	// Change radius value for _both_ heatmap layers
	brmpo_crashes_heat.setRadius(parseInt(radius.value, 10));
	mapc_non_brmpo_crashes_heat.setRadius(parseInt(radius.value, 10));
	// Report value
	radius_text.innerHTML = radius.value;
};
radius.addEventListener('input', radiusHandler);
radius.addEventListener('change', radiusHandler);
//
// End of stuff for heatmap layer parameters
///////////////////////////////////////////////////////////////////////////////


// URLs for MassGIS basemap layer services
var mgis_serviceUrls = { 
    'topo_features'     :  "https://tiles.arcgis.com/tiles/hGdibHYSPO59RG1h/arcgis/rest/services/MassGIS_Topographic_Features_for_Basemap/MapServer",
    'basemap_features'  :  "https://tiles.arcgis.com/tiles/hGdibHYSPO59RG1h/arcgis/rest/services/MassGIS_Basemap_Detailed_Features/MapServer",
    'structures'        :  "https://tiles.arcgis.com/tiles/hGdibHYSPO59RG1h/arcgis/rest/services/MassGIS_Structures/MapServer",
    'parcels'           :  "https://tiles.arcgis.com/tiles/hGdibHYSPO59RG1h/arcgis/rest/services/MassGIS_Level3_Parcels/MapServer"
};

// OpenLayers layers for MassGIS basemap layers used in our map
var mgis_basemap_layers = { 'topo_features'     : null,     // bottom layer
                            'structures'        : null,     
                            'basemap_features'  : null,     // on top of 'structures' so labels aren't obscured
                            'parcels'           : null      // unused; not populated
};

// OpenLayers layer for OpenStreetMap basesmap layer
var osm_basemap_layer = null; 


// Various things for WMS and WFS layers
// First, folderol to allow the app to run on appsrvr3 as well as "in the wild"
var szServerRoot = location.protocol + '//' + location.hostname;
var nameSpace;
if (location.hostname.includes('appsrvr3')) {   
    szServerRoot += ':8080/geoserver/';  
	nameSpace = 'ctps_pg';
} else {
	// Temp hack to allow working from home
    // szServerRoot += '/maploc/';
	szServerRoot = 'https://www.ctps.org/maploc/';
	nameSpace = 'postgis';
}
var szWMSserverRoot = szServerRoot + '/wms'; 
var szWFSserverRoot = szServerRoot + '/wfs'; 

// OpenLayers 'map' object:
var ol_map = null;
var initMapCenter = ol.proj.fromLonLat([-71.0589, 42.3601]);
var initMapZoom = 10;
var initMapView =  new ol.View({ center: initMapCenter, zoom:  initMapZoom });

// Elements that make up an OpenLayers popup 'overlay'
var container = document.getElementById('popup');
var content = document.getElementById('popup-content');
var closer = document.getElementById('popup-closer');
// Add a click handler to hide the popup
closer.onclick = function () { 
	overlay.setPosition(undefined);
	closer.blur();
	return false;
};
// Create an overlay to anchor the popup to the map
var overlay = new ol.Overlay({ element: container,
                               autoPan: { animation: { duration: 250 } }
                             });
// Sledgehammer to enable/disable creation of popup
var popup_on = false;

// Function to toggle basemap
function toggle_basemap(basemap_name) {
    switch(basemap_name) {
		case 'stamen_basemap':
            mgis_basemap_layers['topo_features'].setVisible(false);
            mgis_basemap_layers['structures'].setVisible(false);
            mgis_basemap_layers['basemap_features'].setVisible(false);
			osm_basemap_layer.setVisible(false);
			stamen_basemap_layer.setVisible(true);
			break;
        case 'massgis_basemap' :
			stamen_basemap_layer.setVisible(false);
            osm_basemap_layer.setVisible(false); 
            mgis_basemap_layers['topo_features'].setVisible(true);
            mgis_basemap_layers['structures'].setVisible(true);
            mgis_basemap_layers['basemap_features'].setVisible(true);
            break;        
        case 'osm_basemap' :
            mgis_basemap_layers['topo_features'].setVisible(false);
            mgis_basemap_layers['structures'].setVisible(false);
            mgis_basemap_layers['basemap_features'].setVisible(false);
			stamen_basemap_layer.setVisible(false);
            osm_basemap_layer.setVisible(true);   
            break;
        default:
            break;
    }
	$('#' + basemap_name).prop("checked", true);
} 
// On-change event handler for radio buttons to chose basemap
function toggle_basemap_handler (e) {
	var basemap_name = $(this).val();
	toggle_basemap(basemap_name);
}

// Definition of vector 'overlay' layers:
// In practice, we may wind up using WMS/WFS layers instead of Vector layers for some/all of these,
// but they are nonetheless valuable for use during development and debugging.
// 
// Vector polygon layer for BRMPO region
var brmpo_style = new ol.style.Style({ fill:   new ol.style.Fill({ color: 'rgba(70, 130, 180, 0.3)' }), 
                                       stroke: new ol.style.Stroke({ color: 'rgba(0, 0, 255,1.0)', width: 0.1})
				});
var brmpo = new ol.layer.Vector({ title: 'Boston Region MPO (BRMPO)',
								  source: new ol.source.Vector({  url: 'data/geojson/ctps_brmpo_boundary_poly.geojson',
								                                  format: new ol.format.GeoJSON()
																}),
								  style: brmpo_style
								});

// Vector polygon layer for MAPC area not in BRMPO
var mapc_non_mpo_style = new ol.style.Style({ fill:   new ol.style.Fill({ color: 'rgba(109, 5, 245, 0.3)' }), 
                                              stroke: new ol.style.Stroke({ color: 'rgba(109, 5, 245, 1.0)', width: 0.1})
				});
var mapc_non_mpo = new ol.layer.Vector({ title: 'MAPC area not within Boston Region MPO',
										 source: new ol.source.Vector({ url: 'data/geojson/mapc_non_mpo_boundary_poly.geojson',
										                                format: new ol.format.GeoJSON()
																       }),
										 style: mapc_non_mpo_style
									});
									
// Vector polygon layer for underserved 2010 Census Tracts in MAPC area
var underserved_tracts_style = new ol.style.Style({ fill:   new ol.style.Fill({ color: 'rgba(255, 255, 0, 0.6)' }), 
                                                    stroke: new ol.style.Stroke({ color: 'rgba(0, 0, 0, 1.0)', width: 0.1})
				});
var underserved_tracts = new ol.layer.Vector({ title: 'Underserved Communities',
										      source: new ol.source.Vector({ url: 'data/geojson/underserved_HDC_inMAPC_2010CensusTracts_20220808.geojson',
										                                     format: new ol.format.GeoJSON()
																       }),
										     style: underserved_tracts_style
									});				

// Vector point layer for ALL fatal crashes in MAPC area in 2016-2020
// No longer to be used as of 4:00 p.m., July 28, 2020.
/******************************************************************************	
var mapc_crash_style = new ol.style.Style({ image: new ol.style.Circle({ radius: 2.5,
                                                                          fill: new ol.style.Fill({color: 'red'}) })
                                                                        });
var mapc_crashes = 	new ol.layer.Vector({ title: 'Fatal crashes in MAPC area',
								          source: new ol.source.Vector({  url: 'data/geojson/fatal_crashes_mapc_2016_2020.geojson',
								                                          format: new ol.format.GeoJSON()
																}),
								          style: mapc_crash_style
								});
******************************************************************************/
																	
															
// Vector point layer for accidents in BRMPO area in 2016-2020
var brmpo_crash_style = new ol.style.Style({ image: new ol.style.Circle({ radius: 2.5,
                                                                          fill: new ol.style.Fill({color: 'red'}) })
                                                                        });
var brmpo_crashes = new ol.layer.Vector({ title: 'Fatal crashes in BRMPO',
								          source: new ol.source.Vector({  url: 'data/geojson/fatal_crashes_brmpo_2016_2020.geojson',
								                                          format: new ol.format.GeoJSON()
																}),
								          style: brmpo_crash_style
								});
// Common function for calculating 'weight' of fatal crash features for heatmap layers								
function heatmap_weight_function(feature) {
	var fatals = feature.get('FATALS')
	return fatals / 2;	// max # FATALS = 2; a hack, I know
}

var brmpo_crashes_heat = new ol.layer.Heatmap({ title: 'Fatal crashes in BRMPO heatmap',
                                                source: new ol.source.Vector({ url: 'data/geojson/fatal_crashes_brmpo_2016_2020.geojson',
											                                   format: new ol.format.GeoJSON()
											                               }),
											    blur: 	parseInt(blur.value, 10),
                                                radius: parseInt(radius.value, 10),
                                                weight: heatmap_weight_function });

// Vector point layer for accidents in MAPC area not in BRMPO in 2016-2020
var mapc_non_brmpo_crash_style = new ol.style.Style({ image: new ol.style.Circle({ radius: 2.5,
                                                                                   fill: new ol.style.Fill({color: 'red'}) })
                                                                                 });
var mapc_non_brmpo_crashes = new ol.layer.Vector({ title: 'Fatal crashes in MAPC area, not in BRMPO',
								                   source: new ol.source.Vector({  url: 'data/geojson/fatal_crashes_mapc_non_brmpo_2016_2020.geojson',
								                                                   format: new ol.format.GeoJSON()
																}),
								                   style: mapc_non_brmpo_crash_style
		});

var mapc_non_brmpo_crashes_heat = new ol.layer.Heatmap({ title: 'Fatal crashes in MAPC non-BRMPO heatmap',
                                                source: new ol.source.Vector({ url: 'data/geojson/fatal_crashes_mapc_non_brmpo_2016_2020.geojson',
											                                   format: new ol.format.GeoJSON()
											                               }),
											    blur: 	parseInt(blur.value, 10),
                                                radius: parseInt(radius.value, 10),
                                                weight: heatmap_weight_function });


// Function: initialize()
//     1. Initialize OpenLayers map; get MassGIS basemap service properties by executing AJAX request
//     2. Arm event handlers for UI controls
//
function initialize() {  
    // 1. Initialize OpenLayers map, gets MassGIS basemap service properties by executing AJAX request
    $.ajax({ url: mgis_serviceUrls['topo_features'], jsonp: 'callback', dataType: 'jsonp', data: { f: 'json' }, 
             success: function(config) {     
        // Body of "success" handler starts here.
        // Get resolutions
        var tileInfo = config.tileInfo;
        var resolutions = [];
        for (var i = 0, ii = tileInfo.lods.length; i < ii; ++i) {
            resolutions.push(tileInfo.lods[i].resolution);
        }               
        // Get projection
        var epsg = 'EPSG:' + config.spatialReference.wkid;
        var units = config.units === 'esriMeters' ? 'm' : 'degrees';
        var projection = ol.proj.get(epsg) ? ol.proj.get(epsg) : new ol.proj.Projection({ code: epsg, units: units });                              
        // Get attribution
        var attribution = new ol.control.Attribution({ html: config.copyrightText });               
        // Get full extent
        var fullExtent = [config.fullExtent.xmin, config.fullExtent.ymin, config.fullExtent.xmax, config.fullExtent.ymax];
        
        var tileInfo = config.tileInfo;
        var tileSize = [tileInfo.width || tileInfo.cols, tileInfo.height || tileInfo.rows];
        var tileOrigin = [tileInfo.origin.x, tileInfo.origin.y];
        var urls;
        var suffix = '/tile/{z}/{y}/{x}';
        urls = [mgis_serviceUrls['topo_features'] += suffix];               
        var width = tileSize[0] * resolutions[0];
        var height = tileSize[1] * resolutions[0];     
        var tileUrlFunction, extent, tileGrid;               
        if (projection.getCode() === 'EPSG:4326') {
            tileUrlFunction = function tileUrlFunction(tileCoord) {
                var url = urls.length === 1 ? urls[0] : urls[Math.floor(Math.random() * (urls.length - 0 + 1)) + 0];
                return url.replace('{z}', (tileCoord[0] - 1).toString()).replace('{x}', tileCoord[1].toString()).replace('{y}', (-tileCoord[2] - 1).toString());
            };
        } else {
            extent = [tileOrigin[0], tileOrigin[1] - height, tileOrigin[0] + width, tileOrigin[1]];
            tileGrid = new ol.tilegrid.TileGrid({ origin: tileOrigin, extent: extent, resolutions: resolutions });
        }     

        // MassGIS basemap Layer 1 - topographic features
        var layerSource;
        layerSource = new ol.source.XYZ({ attributions: [attribution], projection: projection,
                                          tileSize: tileSize, tileGrid: tileGrid,
                                          tileUrlFunction: tileUrlFunction, urls: urls });
                          
        mgis_basemap_layers['topo_features'] = new ol.layer.Tile();
        mgis_basemap_layers['topo_features'].setSource(layerSource);
        mgis_basemap_layers['topo_features'].setVisible(false);
        
        // We make the rash assumption that since this set of tiled basemap layers were designed to overlay one another,
        // their projection, extent, and resolutions are the same.
        
         // MassGIS basemap Layer 2 - structures
        urls = [mgis_serviceUrls['structures'] += suffix];  
        layerSource = new ol.source.XYZ({ attributions: [attribution], projection: projection,
                                          tileSize: tileSize, tileGrid: tileGrid,
                                          tileUrlFunction: tileUrlFunction, urls: urls });;
        mgis_basemap_layers['structures'] = new ol.layer.Tile();
        mgis_basemap_layers['structures'].setSource(layerSource); 
        mgis_basemap_layers['structures'].setVisible(false);
        
        // MassGIS basemap Layer 3 - "detailed" features - these include labels
        urls = [mgis_serviceUrls['basemap_features'] += suffix];  
        layerSource = new ol.source.XYZ({ attributions: [attribution], projection: projection,
                                          tileSize: tileSize, tileGrid: tileGrid,
                                          tileUrlFunction: tileUrlFunction, urls: urls });
        mgis_basemap_layers['basemap_features'] = new ol.layer.Tile();
        mgis_basemap_layers['basemap_features'].setSource(layerSource);
        mgis_basemap_layers['basemap_features'].setVisible(false);

                       
        // MassGIS basemap Layer 4 - parcels - WE (CURRENTLY) DO NOT USE THIS LAYER
        // Code retained for reference purposes only
/*
        urls = [mgis_serviceUrls['parcels'] += suffix];
        layerSource = new ol.source.XYZ({ attributions: [attribution], projection: projection,
                                          tileSize: tileSize, tileGrid: tileGrid,
                                          tileUrlFunction: tileUrlFunction, urls: urls });;
        mgis_basemap_layers['parcels'] = new ol.layer.Tile();
        mgis_basemap_layers['parcels'].setSource(layerSource);  
        mgis_basemap_layers['parcels'].setVisible(true);
*/

        // Create OpenStreetMap base layer
        osm_basemap_layer = new ol.layer.Tile({ source: new ol.source.OSM() });
		osm_basemap_layer.setVisible(false);
		
		// Create Stamen 'toner-lite' base layer
	    stamen_basemap_layer = new ol.layer.Tile({ source: new ol.source.Stamen({layer: 'toner-lite',
		                                                                          url: "https://stamen-tiles.a.ssl.fastly.net/toner-lite/{z}/{x}/{y}.png" }) });
		stamen_basemap_layer.setVisible(true);

		// Create WMS layers
		var brmpo_wms = new ol.layer.Tile({	source: new ol.source.TileWMS({ url		: szWMSserverRoot,
																			params	: { 'LAYERS': 'postgis:ctps_brmpo_boundary_poly', 
																						'STYLES': 'ss4a_brmpo_area',
																						'TRANSPARENT': 'true'
																					  }
																		}),
											title: 'Boston Region MPO (BRMPO)',	
											visible: true
										});	
										
		var mapc_non_brmpo_wms = new ol.layer.Tile({ source: new ol.source.TileWMS({ url		: szWMSserverRoot,
																	                 params	: { 'LAYERS': 'postgis:ctps_mapc_non_mpo_boundary_poly', 
																				                'STYLES': 'ss4a_mapc_non_brmpo_area',
																				                'TRANSPARENT': 'true'
																			                  }
																                   }),
									                 title: 'MAPC area not within Boston Region MPO',
													 visible: true
								                   });	
												   
		// This layer renders the boundaries of all MAPC towns (BRMPO and non-BRMPO)
		var all_mapc_towns = new ol.layer.Tile({ source: new ol.source.TileWMS({ url:		szWMSserverRoot,
		                                                                         params: { 'LAYERS' : 'postgis:ctps_all_mapc_towns',
																				           'STYLES' : 'slategray_stroke',
																						   'TRANSPARENT' : true
																				         }
																				}),
												title: 'MAPC town boundaries',
												visible: true
											});

        // Create OpenLayers map
        ol_map = new ol.Map({ layers: [  stamen_basemap_layer, 
										 osm_basemap_layer,
                                         mgis_basemap_layers['topo_features'],
                                         mgis_basemap_layers['structures'],
                                         mgis_basemap_layers['basemap_features'],
										 brmpo_wms,
										 mapc_non_brmpo_wms,
										 all_mapc_towns, 
										 underserved_tracts,
										 brmpo_crashes,
										 brmpo_crashes_heat,
										 mapc_non_brmpo_crashes,
										 mapc_non_brmpo_crashes_heat
                                      ],
                               target: 'map',
                               view:   initMapView,
							   overlays: [overlay]
                            });

		// Proof-of-concept code to display 'popup' overlay:
		if (popup_on == true) {
			ol_map.on('singleclick', function(evt) {
						var coordinate = evt.coordinate;
						var hdms = ol.coordinate.toStringHDMS(ol.proj.toLonLat(coordinate));
						document.getElementById('popup-content');
						content.innerHTML = '<p>You clicked here:</p><code>' + hdms + '</code>';
						overlay.setPosition(coordinate);
					   });
		}
							
		// Add layer switcher add-on conrol
		var layerSwitcher = new ol.control.LayerSwitcher({ tipLabel: 'Legend', // Optional label for button
                                                           groupSelectStyle: 'children', // Can be 'children' [default], 'group' or 'none'
														   activationMode: 'click',
                                                           startActive: true,
														   reverse: false // List layers in order they were added to the map
                                                         });
		ol_map.addControl(layerSwitcher);
    }});
	
    // 2. Arm event handlers for UI control(s)
    // Arm event handler for basemap selection
    $(".basemap_radio").change(toggle_basemap_handler);
	
	$("#reset_map").click(function(e) {
		ol_map.getView().setCenter(initMapCenter);
		ol_map.getView().setZoom(initMapZoom);
		toggle_basemap('stamen_basemap');
		});

	// Help button
	function popup(url) {
		var popupWindow = window.open(url,'popUpWindow','height=700,width=800,left=10,top=10,resizable=yes,scrollbars=yes,toolbar=no,menubar=no,location=no,directories=no,status=yes')
	} // popup()

	displaySupportingDoc = function() {
		popup('supporting_documentation.html');
	}; 
	// event handler
	$('#supporting_doc_button').bind('click', displaySupportingDoc);
} // initialize()
