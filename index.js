const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://khalid-bin-ibrahim-a12.web.app',
    'https://khalid-bin-ibrahim-a12.firebaseapp.com'
  ]
}));
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.hguto33.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    await client.connect();
    const petsCollection = client.db("petsDB").collection("pets");

    // ==========----- GET -----==========
    // get all pets data from database
    app.get('/pets', async (req, res) => {
      const page = parseInt(req.query.page) || 1;
      const limit = 10;
      const skip = (page - 1) * limit;

      try {
        const pets = await petsCollection
          .find()
          .sort({ date: -1 })
          .skip(skip)
          .limit(limit)
          .toArray();

        const totalPets = await petsCollection.countDocuments();
        const hasNextPage = skip + pets.length < totalPets;

        res.json({
          pets,
          nextPage: hasNextPage ? page + 1 : null,
        });
      } catch (error) {
        res.status(500).send(error);
      }
    });

    // get single user pets data from database
    app.get('/user_pets/:id', async (req, res) => {
      const userId = req.params.id;
      const result = await petsCollection.find({ user_id: userId }).toArray();
      res.json(result);
    });

    // get one pet data from database
    app.get('/pets/:id', async (req, res) => {
      const petId = req.params.id;
      const query = { _id: new ObjectId(petId) };
      const result = await petsCollection.find(query).toArray();
      res.json(result);
    });

    // ==========----- POST -----==========
    // sign in user data adding in database
    app.post('/pets', async (req, res) => {
      const pet = req.body;
      pet.date = new Date();
      try {
        const result = await petsCollection.insertOne(pet);
        res.status(201).send(result.ops[0]);
      } catch (error) {
        res.status(400).send(error);
      }
    });

    app.get('/', (req, res) => {
      res.send('Server is running');
    });

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });

    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Uncomment this to close the client after the server is ready
    // await client.close();
  }
}
run().catch(console.dir);
