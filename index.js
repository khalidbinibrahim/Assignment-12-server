const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
    origin: [
        'http://localhost:5173'
    ] 
}))
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Server is running');
})

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});