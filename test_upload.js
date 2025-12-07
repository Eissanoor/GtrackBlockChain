const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

const testUpload = async () => {
    try {
        // Create a dummy file
        const filePath = path.join(__dirname, 'test_doc.txt');
        fs.writeFileSync(filePath, 'This is a test document content.');

        const form = new FormData();
        form.append('memberId', 'MEM123');
        form.append('documentType', 'ID_CARD');
        form.append('document', fs.createReadStream(filePath));

        console.log('Sending request to /api/pos...');
        const response = await axios.post('http://localhost:3000/api/pos', form, {
            headers: {
                ...form.getHeaders()
            }
        });

        console.log('Response:', response.data);
    } catch (error) {
        console.error('Error:', error.response ? error.response.data : error.message);
    }
};

testUpload();
