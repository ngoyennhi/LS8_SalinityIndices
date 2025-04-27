// ==================================================================
// Landsat Masking, Scaling, Visualization, and Index Calculation
// ==================================================================

// --- Functions ---

// Function to mask clouds and shadows in Landsat 8 Collection 2 L2
function maskL8sr(image) {
  var cloudShadowBitMask = (1 << 3);
  var cloudsBitMask = (1 << 4);
  var qa = image.select('QA_PIXEL');
  var mask = qa.bitwiseAnd(cloudShadowBitMask).eq(0)
               .and(qa.bitwiseAnd(cloudsBitMask).eq(0));
  return image.updateMask(mask);
}

// Function to apply scaling factors for Landsat Collection 2 SR optical bands
function scaleLandsatSR(image) {
  var opticalBands = image.select('SR_B.*')
                          .multiply(0.0000275)
                          .add(-0.2);
  return image.addBands(opticalBands, null, true);
}

// --- Workflow ---

// 1. Define Area of Interest (AOI) - Tien Giang
var provinces = ee.FeatureCollection("FAO/GAUL/2015/level1");
var tienGiang = provinces.filter(ee.Filter.and(
  ee.Filter.eq('ADM0_NAME', 'Viet Nam'),
  ee.Filter.eq('ADM1_NAME', 'Tien Giang')
));
Map.centerObject(tienGiang, 9);
Map.addLayer(tienGiang, {color: 'FF0000', strokeWidth: 2, fillColor: '00000000'}, 'Tien Giang Outline');

// 2. Define Image ID and Load Image
var imageId = 'LANDSAT/LC08/C02/T1_L2/LC08_125053_20210703';
var rawImage = ee.Image(imageId);
print('Loaded Raw Image:', rawImage);

// 3. Apply Cloud Mask FIRST
var maskedImage = maskL8sr(rawImage);
print('Masked Image (before scaling):', maskedImage);


// 4. Apply Scaling AFTER Masking
var scaledMaskedImage = scaleLandsatSR(maskedImage);
print('Scaled and Masked Image:', scaledMaskedImage);


// ========== 5. CALCULATE INDICES ==========
print('Calculating Indices...');

// Select the required SCALED bands
var blue = scaledMaskedImage.select('SR_B2');  // Blue
var green = scaledMaskedImage.select('SR_B3'); // Green
var red = scaledMaskedImage.select('SR_B4');   // Red
var nir = scaledMaskedImage.select('SR_B5');   // NIR

// --- Calculate Salinity Indices (SI) ---
// SI1 = sqrt(Green^2 + Red^2)
var si1 = green.pow(2).add(red.pow(2)).sqrt().rename('SI1');
print('SI1 Image:', si1);

// SI2 = sqrt(Green * Red)
var si2 = green.multiply(red).sqrt().rename('SI2');
print('SI2 Image:', si2);

// SI3 = sqrt(Blue * Red)
var si3 = blue.multiply(red).sqrt().rename('SI3');
print('SI3 Image:', si3);

// SI4a = sqrt(Red * NIR) / Green
var si4a = red.multiply(nir).sqrt().divide(green).rename('SI4a');
print('SI4a Image:', si4a);

// SI5 = Blue / Red  (Previously SI4b)
var si5 = blue.divide(red).rename('SI5'); // Renamed variable and band
print('SI5 Image:', si5); // Updated print

// --- Calculate Normalized Difference Salinity Index (NDSI) ---
// NDSI = (Red - NIR) / (Red + NIR)
var ndsi = scaledMaskedImage.normalizedDifference(['SR_B4', 'SR_B5']).rename('NDSI');
print('NDSI Image:', ndsi);

// --- Calculate Normalized Difference Vegetation Index (NDVI) ---
// NDVI = (NIR - Red) / (NIR + Red)
var ndvi = scaledMaskedImage.normalizedDifference(['SR_B5', 'SR_B4']).rename('NDVI');
print('NDVI Image:', ndvi);

// --- Calculate Soil Adjusted Vegetation Index (SAVI) ---
// Using standard formula SAVI = ((NIR - Red) / (NIR + Red + L)) * (1 + L), with L=0.5
var L = 0.5;
var savi = scaledMaskedImage.expression(
    '(1 + L) * (NIR - RED) / (NIR + RED + L)', {
      'NIR': nir,
      'RED': red,
      'L': L
    }).rename('SAVI');
print('SAVI Image:', savi);

// --- Calculate Vegetation Soil Salinity Index (VSSI) ---
// VSSI = 2 * Green - 5 * (Red + NIR)
var vssi = scaledMaskedImage.expression(
    '2 * bGREEN - 5 * (bRED + bNIR)', {
      'bGREEN': green,
      'bRED': red,
      'bNIR': nir
    }).rename('VSSI');
print('VSSI Image:', vssi);

// ==========================================


// 6. Define Visualization Parameters

// True Color visualization
var visParamsTrueColor = { bands: ['SR_B4', 'SR_B3', 'SR_B2'], min: 0.0, max: 0.3 };

// Grayscale visualization for NIR
var visParamsGrayNIR = { bands: ['SR_B5'], min: 0.0, max: 0.5 }; // Adjust max!

// --- Visualization for Indices ---
// NOTE: Min/Max values for SI*, VSSI are EXAMPLES. Use Inspector tool to adjust!
var visSI1 = { bands: ['SI1'], min: 0.05, max: 0.25, palette: ['#fde725', '#5ec962', '#21918c', '#3b528b', '#440154'] }; // Viridis palette
var visSI2 = { bands: ['SI2'], min: 0.05, max: 0.15, palette: ['#fde725', '#5ec962', '#21918c', '#3b528b', '#440154'] };
var visSI3 = { bands: ['SI3'], min: 0.05, max: 0.15, palette: ['#fde725', '#5ec962', '#21918c', '#3b528b', '#440154'] };
var visSI4a = { bands: ['SI4a'], min: 1.5, max: 2.5, palette: ['#fde725', '#5ec962', '#21918c', '#3b528b', '#440154'] };
var visSI5 = { bands: ['SI5'], min: 0.6, max: 1, palette: ['#fde725', '#5ec962', '#21918c', '#3b528b', '#440154'] }; // Renamed variable and band
var visNDSI = { bands: ['NDSI'], min: -1, max: 1, palette: ['006400', 'adff2f', 'ffff00', 'ffa500', 'ff0000', '800080'] }; // Green->Purple
var visNDVI = { bands: ['NDVI'], min: -0.2, max: 0.8, palette: ['#ffffe5', '#f7fcb9', '#d9f0a3', '#addd8e', '#78c679', '#41ab5d', '#238443', '#005a32'] }; // Standard NDVI palette
var visSAVI = { bands: ['SAVI'], min: 0.005, max: 0.7, palette: ['#ffffe5', '#f7fcb9', '#d9f0a3', '#addd8e', '#78c679', '#41ab5d', '#238443', '#005a32'] }; // Similar to NDVI
var visVSSI = { bands: ['VSSI'], min: -2.0, max: 0, palette: ['blue', 'cyan', 'green', 'yellow', 'red'] }; // Adjust min/max!

// ==========================================


// 7. Add Processed Layers to the Map

// Add True Color layer (visible by default)
Map.addLayer(scaledMaskedImage.clip(tienGiang), visParamsTrueColor, 'Landsat Scaled Masked (True Color)', true);

// Add Grayscale NIR layer (hidden by default)
Map.addLayer(scaledMaskedImage.clip(tienGiang), visParamsGrayNIR, 'Landsat Scaled Masked (NIR Grayscale)', false);

// --- Add Index Layers (hidden by default) ---
Map.addLayer(si1.clip(tienGiang), visSI1, 'SI1 = sqrt(G^2+R^2)', false);
Map.addLayer(si2.clip(tienGiang), visSI2, 'SI2 = sqrt(G*R)', false);
Map.addLayer(si3.clip(tienGiang), visSI3, 'SI3 = sqrt(B*R)', false);
Map.addLayer(si4a.clip(tienGiang), visSI4a, 'SI4a = sqrt(R*NIR)/G', false);
Map.addLayer(si5.clip(tienGiang), visSI5, 'SI5 = B/R', false);
Map.addLayer(ndsi.clip(tienGiang), visNDSI, 'NDSI = (R-NIR)/(R+NIR)', false);
Map.addLayer(ndvi.clip(tienGiang), visNDVI, 'NDVI = (NIR-R)/(NIR+R)', false);
Map.addLayer(savi.clip(tienGiang), visSAVI, 'SAVI (L=0.5)', false);
Map.addLayer(vssi.clip(tienGiang), visVSSI, 'VSSI = 2G-5(R+NIR)', false);
// ==========================================


print('Added all layers to map. Use Inspector tool to refine visualization ranges for SI*, SAVI, VSSI.');


// ========== 8. EXPORT CALCULATED INDICES ==========
print('Setting up export task...');

// Combine all calculated indices into one multi-band image
// Each index will be a separate band in the output GeoTIFF
var allIndicesImage = ee.Image().addBands([
    si1,
    si2,
    si3,
    si4a,
    si5,
    ndsi,
    ndvi,
    savi,
    vssi
  ]); // Add other indices if needed

print('Combined indices image:', allIndicesImage); // Check band names
var allIndicesImageFloat = allIndicesImage.toFloat();


// Define export parameters
var exportFolder = 'GEE_Exports'; 
var exportFileName = 'Landsat_Indices_TienGiang_20210703'; 
var exportScale = 30; // Landsat resolution in meters
var exportCRS = 'EPSG:32648'; // UTM Zone 48N (covers Tien Giang) - Good for analysis

// Create the export task using the CASTED image
Export.image.toDrive({
  image: allIndicesImageFloat,         // <<< Use the casted image
  description: exportFileName,       // Name of the task in GEE Tasks tab
  folder: exportFolder,              // Google Drive folder
  fileNamePrefix: exportFileName,    // Output file name (will add .tif)
  region: tienGiang.geometry(),      // Area to export (geometry of Tien Giang)
  scale: exportScale,                // Resolution
  crs: exportCRS,                    // Coordinate Reference System
  maxPixels: 1e10                    // Allow more pixels for export
});