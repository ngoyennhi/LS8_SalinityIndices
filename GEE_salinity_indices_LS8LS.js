// Function to mask clouds and shadows in Landsat 8 Collection 2 L2
function maskL8sr(image) {
  var cloudShadowBitMask = (1 << 3);
  var cloudsBitMask = (1 << 4);
  var qa = image.select('QA_PIXEL');
  var mask = qa.bitwiseAnd(cloudShadowBitMask).eq(0)
                 .and(qa.bitwiseAnd(cloudsBitMask).eq(0));
  return image.updateMask(mask);
}

//  1. Charger Tiền Giang depuis GAUL
var provinces = ee.FeatureCollection("FAO/GAUL/2015/level1");
var tienGiang = provinces.filter(ee.Filter.and(
  ee.Filter.eq('ADM0_NAME', 'Viet Nam'),
  ee.Filter.eq('ADM1_NAME', 'Tien Giang')
));
Map.centerObject(tienGiang, 9);
Map.addLayer(tienGiang, {color: 'FF0000', strokeWidth: 2}, 'Tien Giang Outline', false);

//  2. Define the full Image ID
var imageId = 'LANDSAT/LC08/C02/T1_L2/LC08_125053_20210703';

//  3. Load the specific image
var specificImage = ee.Image(imageId);

//  4. Apply the cloud mask
var maskedImage = maskL8sr(specificImage);

//  5. Define visualization parameters for SINGLE BAND (Grayscale)
// --- MODIFICATION FOR GRAYSCALE ---
var bandToShow = 'SR_B5'; // Example: Near Infrared band
//IMPORTANT: Use Inspector tool on the map to find suitable min/max for SR_B5
var grayVisParams = {
  bands: [bandToShow],
  min: 0,  // EXAMPLE MIN - Adjust based on Inspector!
  max: 20000   // EXAMPLE MAX - Adjust based on Inspector!
};

//  6. Add the masked, clipped, grayscale image to the map
Map.addLayer(
  maskedImage.clip(tienGiang),
  grayVisParams, // Use the grayscale visualization parameters
  bandToShow + ' (Grayscale, Masked & Clipped)'
);

print('Displaying band:', bandToShow);

// ---------------------------------------------------------------
//  Calculate the three specified Salinity Indices
// ---------------------------------------------------------------

// --- Index 1: SI = sqrt(Green * Red) ---
var green_b3 = maskedImage.select('SR_B3');
var red_b4 = maskedImage.select('SR_B4');
var SI = green_b3.multiply(red_b4).sqrt().rename('SI');
print('SI Image:', SI);

// --- Index 2: SI2 = sqrt(Green^2 + Red^2 + NIR^2) ---
var nir_b5 = maskedImage.select('SR_B5');
var SI2 = green_b3.pow(2)
            .add(red_b4.pow(2))
            .add(nir_b5.pow(2))
            .sqrt().rename('SI2');
print('SI2 Image:', SI2);

// --- Index 3: NDSI = (Red - NIR) / (Red + NIR) ---
// This is equivalent to -NDVI. Using normalizedDifference for calculation.
// normalizedDifference calculates (Band1 - Band2) / (Band1 + Band2)
var NDSI = maskedImage.normalizedDifference(['SR_B4', 'SR_B5']).rename('NDSI');
print('NDSI (-NDVI) Image:', NDSI);


// ---------------------------------------------------------------
//  Define Visualization Parameters for Each Index
// IMPORTANT: Adjust min/max for EACH index using the Inspector tool!
// ---------------------------------------------------------------

var visParams_SI = {
  min: 9000, // Adjust! Check SI layer with Inspector
  max: 15000, // Adjust! Check SI layer with Inspector
  palette: ['eff3ff', 'bdd7e7', '6baed6', '3182bd', '08519c'] // Example: Sequential Blue
};

var visParams_SI2 = {
  min: 9000, // Adjust! Check SI2 layer with Inspector (likely higher max needed)
  max: 30000, // Adjust! Check SI2 layer with Inspector
  palette: ['fff7ec', 'fee8c8', 'fdd49e', 'fdbb84', 'fc8d59', 'ef6548', 'd7301f', '990000'] // Example: Sequential Orange-Red
};

var visParams_NDSI = {
  min: -0.5, // Adjust! Check NDSI layer with Inspector (Range is -1 to 1, typical ground values vary)
  max: 0.5,  // Adjust! Check NDSI layer with Inspector
  palette: ['0000ff', '00ffff', 'ffffff', 'ffff00', 'ff0000'] // Example: Blue -> Cyan -> White -> Yellow -> Red
};


// ---------------------------------------------------------------
//  Add Calculated Indices to the Map (Clipped)
// ---------------------------------------------------------------

Map.addLayer(SI.clip(tienGiang), visParams_SI, 'Index SI (sqrt(G*R))', false); // Initially off
Map.addLayer(SI2.clip(tienGiang), visParams_SI2, 'Index SI2 (sqrt(G^2+R^2+N^2))', false); // Initially off
Map.addLayer(NDSI.clip(tienGiang), visParams_NDSI, 'Index NDSI ((R-N)/(R+N))', true); // Initially on

// Optional: Add the masked true color image for reference
var visParams_RGB = { bands: ['SR_B4', 'SR_B3', 'SR_B2'], min: 5000, max: 15000 };
Map.addLayer(maskedImage.clip(tienGiang), visParams_RGB, 'Masked True Color Image', false);


// ---------------------------------------------------------------
//  Export the Calculated Indices to Google Drive as GeoTIFF
// ---------------------------------------------------------------

// Define export parameters common to all exports
var exportRegion = tienGiang.geometry(); // Export the area defined by Tien Giang boundary
var exportScale = 30; // Export at Landsat's 30m resolution
var exportCrs = 'EPSG:4326'; // Set Coordinate Reference System to WGS84
var driveFolder = 'GEE_Salinity_Indices'; // Optional: Name of folder in your Google Drive root

// --- Export Task for Index 1: SI ---
Export.image.toDrive({
  image: SI,                           // The SI index image (single band)
  description: 'Export_SI_TienGiang_20210703', // Name of the task in the 'Tasks' tab
  folder: driveFolder,                 // Folder in Google Drive to save to
  fileNamePrefix: 'SI_TienGiang_20210703',     // Base name for the output GeoTIFF file
  region: exportRegion,                // Specify the geometry to export
  scale: exportScale,                  // Specify the pixel resolution
  crs: exportCrs,                      // Specify the coordinate system (WGS84)
  maxPixels: 1e10                      // Increase maxPixels for larger exports if needed
  // fileFormat: 'GeoTIFF'             // Default format is GeoTIFF, so this line is optional
});

// --- Export Task for Index 2: SI2 ---
Export.image.toDrive({
  image: SI2,                          // The SI2 index image
  description: 'Export_SI2_TienGiang_20210703',// Unique task name
  folder: driveFolder,
  fileNamePrefix: 'SI2_TienGiang_20210703',    // Unique filename prefix
  region: exportRegion,
  scale: exportScale,
  crs: exportCrs,
  maxPixels: 1e10
});

// --- Export Task for Index 3: NDSI ---
Export.image.toDrive({
  image: NDSI,                         // The NDSI index image
  description: 'Export_NDSI_TienGiang_20210703',// Unique task name
  folder: driveFolder,
  fileNamePrefix: 'NDSI_TienGiang_20210703',   // Unique filename prefix
  region: exportRegion,
  scale: exportScale,
  crs: exportCrs,
  maxPixels: 1e10
});

print('Export tasks created. Check the "Tasks" tab to run them.');