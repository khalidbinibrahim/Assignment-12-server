const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { resourceLimits } = require('worker_threads');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
    origin: [
        'http://localhost:5173'
    ] 
}))
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.hguto33.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const petsCollection = client.db("petsDB").collection("pets");
    const usersCollection = client.db("petsDB").collection("users");

    // ==========----- GET -----==========
    // get all pets data from database
    app.get('/pets', async (req, res) => {
      const result = await petsCollection.find().toArray();
      res.json(result);
    });

    // get single user pets data from database
    app.get('/user_pets:id', async (req, res) => {
      const userId = req.params.id;
      const result = await petsCollection.find({ user_id: userId }).toArray();
      res.json(result);
    });

    // get one pet data from database
    app.get('/pets:id', async (req, res) => {
      const petId = req.params.id;
      const query = { _id: new ObjectId(petId) };
      const result = await petsCollection.find(query).toArray();
      res.json(result);
    });

    // ==========----- POST -----==========
    // sign in user data adding in database
    app.post('/users', async (req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      res.status(201).json({message: 'user successfully added in database'}).send(result);
    });

    app.get('/', (req, res) => {
        res.send('Server is running');
    });
    
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();    
  }
}
run().catch(console.dir);
