// test_api.js
const request = require('supertest');
const { expect } = require('chai');
const path = require('path'); // Import the path module for reliable file paths
const fs = require('fs'); // Import fs to check if the test image exists

// Replace with the URL of your running server
const API_URL = 'http://localhost:5000';

describe('API Endpoint Tests', function() {
    this.timeout(10000); // Set a higher timeout for API calls to prevent timeouts

    // Define sample data to use in POST requests
    const samplePatrolData = {
        "patrol_officer_name": "Test Officer",
        "start_time": "2025-09-03T10:00:00Z",
        "end_time": "2025-09-03T12:00:00Z",
        "start_location": "Test Start",
        "end_location": "Test End",
        "distance_kms": 10.5,
        "path_coords": [
            { "latitude": 10.0, "longitude": 20.0 },
            { "latitude": 10.1, "longitude": 20.1 }
        ]
    };
    const sampleIncidentData = {
        "incident_category_id": 1,
        "incident_time": "2025-09-03T10:45:00Z",
        "latitude": 10.05,
        "longitude": 20.05,
        "incident_reported_by": "Test Officer",
        "incident_description": "Test incident description."
    };
    const testUserId = "2";
    
    // Updated path to point to the 'Incidentimage' directory
    const testImagePath = path.join(__dirname, '..', 'Incidentimage', 'Screenshot 2025-08-01 104124.png');

    // Before running any tests, check if the test image exists.
    // This provides a clear error message instead of an ENOENT error during the test run.
    before(function() {
        try {
            fs.accessSync(testImagePath, fs.constants.F_OK);
        } catch (e) {
            console.error(`\nError: The test image file '${testImagePath}' does not exist.`);
            console.error('Please create a dummy image file named "test-image.jpg" and place it in the Incidentimage directory.\n');
            throw e;
        }
    });

    // Clean up: delete the test image file after all tests are done
    after(function() {
        try {
            if (fs.existsSync(testImagePath)) {
                fs.unlinkSync(testImagePath);
                console.log(`\nCleaned up test image file: ${testImagePath}`);
            }
        } catch (e) {
            console.error(`Error during test cleanup: ${e.message}`);
        }
    });

    // Test case for the GET incident categories API
    describe('GET /api/incident-categories', function() {
        it('should retrieve a list of incident categories', async function() {
            const res = await request(API_URL).get('/api/incident-categories');
            
            // Check the HTTP status code and response body structure
            expect(res.status).to.equal(200);
            expect(res.body).to.be.an('array');
            if (res.body.length > 0) {
                // Corrected the property name to 'category_id' to match the API response
                expect(res.body[0]).to.have.property('category_id');
                expect(res.body[0]).to.have.property('category_name');
            }
        });
    });

    // Test case for the GET incidents with images API
    describe('GET /api/incidents-with-images', function() {
        it('should retrieve incidents with images for a given user_id', async function() {
            const res = await request(API_URL).get(`/api/incidents-with-images?user_id=${testUserId}`);
            
            // Check the response
            expect(res.status).to.equal(200);
            expect(res.body).to.be.an('array');
            if (res.body.length > 0) {
                // Fixed: Convert testUserId to a number for the assertion
                expect(res.body[0]).to.have.property('user_id', Number(testUserId));
                expect(res.body[0]).to.have.property('image_urls').that.is.an('array');
            }
        });

        it('should return a 400 error if user_id is missing', async function() {
            const res = await request(API_URL).get('/api/incidents-with-images');
            
            expect(res.status).to.equal(400);
            expect(res.body).to.have.property('error', 'Missing required query parameter: user_id');
        });
    });

    // Test case for the GET patrols by user API
    describe('GET /api/patrols-by-user', function() {
        it('should retrieve patrols for a given user_id', async function() {
            const res = await request(API_URL).get(`/api/patrols-by-user?user_id=${testUserId}`);
            
            // Check the response
            expect(res.status).to.equal(200);
            expect(res.body).to.be.an('array');
            if (res.body.length > 0) {
                // Fixed: Convert testUserId to a number for the assertion
                expect(res.body[0]).to.have.property('user_id', Number(testUserId));
            }
        });

        it('should return a 400 error if user_id is missing', async function() {
            const res = await request(API_URL).get('/api/patrols-by-user');
            
            expect(res.status).to.equal(400);
            expect(res.body).to.have.property('error', 'Missing required query parameter: user_id');
        });
    });

    // Test case for the POST full incident API (this is a complex one)
    describe('POST /api/full-incident', function() {
        it('should successfully create a new patrol and incident entry with images', async function() {
            const res = await request(API_URL)
                .post('/api/full-incident')
                .field('patrol', JSON.stringify(samplePatrolData))
                .field('incident', JSON.stringify(sampleIncidentData))
                .field('user_id', testUserId)
                .attach('images', testImagePath); // Use the correct file path
            
            // Check for successful creation
            expect(res.status).to.equal(201);
            expect(res.body).to.have.property('message', 'All data inserted successfully');
            expect(res.body).to.have.property('patrol_id');
            expect(res.body).to.have.property('incident_id');
        });
        
        it('should successfully create a new patrol and incident entry without images', async function() {
            const res = await request(API_URL)
                .post('/api/full-incident')
                .field('patrol', JSON.stringify(samplePatrolData))
                .field('incident', JSON.stringify(sampleIncidentData))
                .field('user_id', testUserId);

            // Check for successful creation
            expect(res.status).to.equal(201);
            expect(res.body).to.have.property('message', 'All data inserted successfully');
        });
        
        it('should return a 400 error for invalid JSON format', async function() {
            const res = await request(API_URL)
                .post('/api/full-incident')
                .field('patrol', '{"invalid_json": "data",}') // Malformed JSON
                .field('incident', JSON.stringify(sampleIncidentData))
                .field('user_id', testUserId);
            
            expect(res.status).to.equal(400);
            expect(res.body).to.have.property('error', 'Invalid JSON format for patrol or incident data.');
        });
        
        it('should return a 400 error if patrol or incident data is missing', async function() {
            const res = await request(API_URL)
                .post('/api/full-incident')
                .field('user_id', testUserId);

            expect(res.status).to.equal(400);
            expect(res.body).to.have.property('error', 'Invalid JSON format for patrol or incident data.');
        });
    });
});
