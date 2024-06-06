const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
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
  ],
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// JWT middleware
const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    req.user = decoded;
    next();
  });
};

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
    const adoptionsCollection = client.db("petsDB").collection("adoptions");
    const usersCollection = client.db("petsDB").collection("users");
    const campaignsCollection = client.db("petsDB").collection("campaigns");

    // ==========----- AUTH RELATED API -----==========

    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '6h' });

      res.send({
        message: 'Your access token successfully sent',
        token
      });
    });

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
    app.get('/pets/:id', verifyToken, async (req, res) => {
      const petId = req.params.id;
      try {
        const query = { _id: new ObjectId(petId) };
        const result = await petsCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.error('Error retrieving pet data:', error);
        res.status(500).send(error);
      }
    });

    app.get('/campaigns', async (req, res) => {
      const { page = 1, limit = 9 } = req.query;
      const skip = (page - 1) * limit;
    
      try {
        const campaigns = await campaignsCollection
          .find()
          .sort({ date: -1 })
          .skip(parseInt(skip))
          .limit(parseInt(limit))
          .toArray();
    
        res.json(campaigns);
      } catch (error) {
        res.status(500).send(error);
      }
    });

    // ==========----- POST -----==========
    // sign in user data adding in database
    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user.email }
      const existingUser = await usersCollection.findOne(query);
      if(existingUser) {
        return res.send({ message: 'user already exists', insertedId: null })
      }

      const result = await usersCollection.insertOne(user);
      res.status(201).send(result);
    })

    app.post('/pets', async (req, res) => {
      const pet = req.body;
      pet.date = new Date();
      try {
        const result = await petsCollection.insertOne(pet);
        res.status(201).send(result);
      } catch (error) {
        res.status(400).send(error);
      }
    });

    app.post('/adoptions', verifyToken, async (req, res) => {
      const adoption = req.body;
      try {
        const result = await adoptionsCollection.insertOne(adoption);
        res.status(201).send(result);
      } catch (error) {
        console.error("Error inserting adoption request:", error);
        res.status(400).send(error);
      }
    });

    app.post('/pets', async (req, res) => {
      try {
        const { petImage, petName, petAge, petCategory, petLocation, shortDescription, longDescription, dateAdded, adopted } = req.body;
    
        const newPet = {
          petImage,
          petName,
          petAge,
          petCategory,
          petLocation,
          shortDescription,
          longDescription,
          dateAdded,
          adopted,
        };
    
        await petsCollection.insertOne(newPet);
        res.status(201).send('Pet added successfully');
      } catch (error) {
        console.error('Error adding pet', error);
        res.status(500).send('Error adding pet');
      } finally {
        await client.close();
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
