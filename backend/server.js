const express = require('express');
const cors = require('cors');
const ee = require('@google/earthengine');
const path = require('path');
const fs = require('fs');


const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());




const privateKey = {
  "type": "service_account",
  "project_id": "gee-mobile-app",
  "private_key_id": "3e53b1c07c5387bffe935d5df9b6230beab19ce1",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDMFZB5B7qn+lcu\nvtGYPIhVvleFa8C09kT5UMeXM0PqJ+Hshk2WcBzffesYiIQsoR7KZj877Wu5/azK\nXE5kejdmweASMeroeun6OjOAsdLKHjLBZARhafA7NqKN2AkIuaOK+cFknOnEawrl\ncutMNAF2OH9ICJPzcRjTfQWs3ZbTLckzt28cg544C7nFxDi7gk8LoEB+Qjj446PK\n9VAE4Nc8kGeg0NLAQ4fFPPbKHxQki4IQZIjxcSO7PCGKXoOaH/NZkTL8F7Z1o5gW\nktJBKA6trp0BjglbjId3kz9I9Td+zbpBFFJfg5sOQQoNAPxC3XQYNKBzmlgB+ZkM\nVAH66ttxAgMBAAECggEAGKfER/LomHGUhce0z5UEjYNM1IgThGk6JPqe2kPtwQSn\ndSk2h2Ws/00ZkWGwwimG7EHVAtroiFQ+w0XKjLX9KnNirCAOtp5e1QWiAjq5cgSa\n8iUwqEohpS2xDrzaPo0a1mfc9thEH6Ak9VpgVdj0kkE6E0xB/4eazbYNcPhmR8XJ\nhY6Kx5iNi3e7zh/ipQvNKKqxItIa2qwxp+K79+e/0BsPHQ9Jjr8VnIo52dQufF5X\n/w1f97GqEhwtafFKGmq89DnxSjPUeZ2s8v9yRkD9D3HEKmYLGkYCbabAF8cpGNKX\n1tDUUdpFjKNeX3AlQUtau7Q/g+K9pk//4Tu/cuq6YQKBgQDsljlygL0nm7tQ9Oy0\nJUvNkVwFQlTy/bu1lhXyNs5rgbriZttHOV20FGntakTyab2OFqJaDDTAh7L5exck\nslmFzz59rpHsmzxrhjXAg1rIlBS1h5B/sdvgpwiBxnmGeja6DnOf2Tgla2qWRP/i\nPhPMGXNp/DIwMHOfmyNtn/uDmQKBgQDc1JYUmG8kbzt291xqcojifr/hfgI0H8GA\n8wNLKQTVbrmsms0PTQAJqtkSAXQcDbaEAh7yemsJPaXqkuKu07OANssBFnRzt/aJ\n1xzMO/VbbRNYVMBtcRIQ1KzDaN3srHV7X/xwabmnsPAPXB+Jjgok9kSPbXS/jrva\nEjjqZ8P9mQKBgFoejxtytprT03JvGYs1eb6AVFEch0dYJ5xv40Q0ZETHUezTyUtE\nKtFhxUfOZxz/8lihfo5Wf/GmvyIRJSuxVDCIVQGC8crzBvzeTrNaVcZ5wbm0PfKm\nSV81wSPN+pSjER2mS5zkHWMDm8JJ3j7L7racKz5/9o4spp5xdflYK3JhAoGBAMfA\n/OkwYgjhHTcl1lDrveqzoLpGk5O2zgDo0afhOOAfwpDhjnAyxL/57VUeP3tI5DpQ\n+NF57uxy+WxQ5gAiu5JU/hjDyR8L31UcYo5UBkNnTUJvl4jn6OGUn5o7d9OoxLSP\nRPgiiq+nm98pA9YXyBFbOvVKm3rTkBVYumc+6cixAoGAE9H5SLIbeYs/mF706rc2\nq6+4ovW/Jbtk5CHhGiA8ReXGqWFhEsyxVJPJMBUSjHdq95f+juxM2GlVJ/IIp8Zj\nrpU9bT+RHEH6Ih+qtywmIyiagAl7HovL5seFvFG9G2lYwlXe5k+/EQAGzt2VsQEt\nw44UxfxcVHJE/cC9nulQdBw=\n-----END PRIVATE KEY-----\n",
  "client_email": "giz-370@gee-mobile-app.iam.gserviceaccount.com",
  "client_id": "113124609323904869034",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/giz-370%40gee-mobile-app.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
}

// Initialize Earth Engine
const initializeEarthEngine = async () => {
    return new Promise((resolve, reject) => {
        ee.data.authenticateViaPrivateKey(
            privateKey,
            () => {
                ee.initialize(
                    null,
                    null,
                    () => {
                        console.log('Earth Engine initialized successfully');
                        resolve();
                    },
                    (error) => {
                        console.error('Earth Engine initialization error:', error);
                        reject(error);
                    }
                );
            },
            (error) => {
                console.error('Authentication error:', error);
                reject(error);
            }
        );
    });
};

// Earth Engine processing functions
const addIndices = (image) => {
    const ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI');
    const ndwi = image.normalizedDifference(['B3', 'B8']).rename('NDWI');
    return image.addBands([ndvi, ndwi]);
};

const maskS2clouds = (image) => {
    const qa = image.select('QA60');
    const cloudBitMask = 1 << 10;
    const cirrusBitMask = 1 << 11;
    const mask = qa.bitwiseAnd(cloudBitMask).eq(0)
        .and(qa.bitwiseAnd(cirrusBitMask).eq(0));
    return image.updateMask(mask).divide(10000)
        .copyProperties(image, ["system:time_start"]);
};

// Helper function to get thumbnail URL
const getThumbUrl = (image, visParams) => {
    return new Promise((resolve, reject) => {
        image.getThumbURL({
            dimensions: 512,
            region: image.geometry(),
            format: 'png',
            ...visParams
        }, (url, error) => {
            if (error) reject(error);
            else resolve(url);
        });
    });
};

// Helper function to get time series data
const getTimeSeriesData = (collection, region) => {
    return new Promise((resolve, reject) => {
        // Create a chart for the time series
        const chart = ui.Chart.image.series({
            imageCollection: collection,
            region: region,
            reducer: ee.Reducer.mean(),
            scale: 100
        });

        // Get the chart data
        chart.getInfo((info, error) => {
            if (error) reject(error);
            else resolve(info);
        });
    });
};

// Process chart data for client
const processChartData = (chartInfo) => {
    if (!chartInfo || !chartInfo.data) return { data: [] };

    return {
        data: chartInfo.data.map(row => ({
            date: row.label,
            value: row.value
        })),
        properties: chartInfo.properties
    };
};

// Main API endpoint
app.post('/api/analyze', async (req, res) => {
  try {
    const { geometry, startDate, endDate } = req.body;

    if (!geometry || !startDate || !endDate) {
      return res.status(400).json({
        error: 'Missing required parameters: geometry, startDate, endDate'
      });
    }

    const region = ee.Geometry(geometry);
    const s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED');

    const filtered = s2
      .filterDate(startDate, endDate)
      .filterBounds(region)
      .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
      .map(maskS2clouds)
      .map(addIndices);

    const count = filtered.size().getInfo();

    if (count === 0) {
      return res.status(404).json({
        error: 'No satellite images found for the specified criteria'
      });
    }

    const ndviMedian = filtered.select('NDVI').reduce(ee.Reducer.percentile([25]));
    const ndwiMedian = filtered.select('NDWI').reduce(ee.Reducer.percentile([25]));
    const medianImage = filtered.median();

    const [ndviUrl, ndwiUrl, rgbUrl] = await Promise.all([
      getThumbUrl(ndviMedian.clip(region), {
        min: 0, max: 0.3, palette: ['white', 'green']
      }),
      getThumbUrl(ndwiMedian.clip(region), {
        min: 0, max: 0.3, palette: ['white', 'blue']
      }),
      getThumbUrl(medianImage.clip(region), {
        min: 0, max: 0.3, bands: ['B4', 'B3', 'B2'] // Note: Sentinel-2 bands are reflectance * 10000, adjust max accordingly
      })
    ]);

    res.json({
      success: true,
      images: {
        ndvi: ndviUrl,
        ndwi: ndwiUrl,
        rgb: rgbUrl
      },
      metadata: {
        imageCount: count,
        dateRange: { startDate, endDate }
      }
    });

  } catch (error) {
    console.error('Processing error:', error);
    res.status(500).json({
      error: 'Failed to process request',
      details: error.message
    });
  }
});


// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'Server is running' });
});

// Test endpoint without Earth Engine auth
app.get('/test', (req, res) => {
    res.json({ message: 'Server is working correctly!' });
});

// Initialize and start server
console.log('Starting server initialization...');

// Start the server first, then initialize Earth Engine
app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    console.log('Initializing Earth Engine...');
    
    try {
        await initializeEarthEngine();
        console.log('Earth Engine initialized successfully');
    } catch (error) {
        console.error('Failed to initialize Earth Engine:', error);
        console.log('Server is running but Earth Engine functionality will not work');
    }
});

console.log('Server starting up...');