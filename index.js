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
    // await client.connect();
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

    app.get('/user_pets', verifyToken, async (req, res) => {
      const userEmail = req.user.email;  // Get the email of the logged-in user from the token

      try {
        const pets = await petsCollection.find({ userEmail }).sort({ date: -1 }).toArray();
        res.json({ pets });
      } catch (error) {
        console.error('Error retrieving user pets:', error);
        res.status(500).send('Internal Server Error');
      }
    });


    app.get('/user_adoption_requests', verifyToken, async (req, res) => {
      const userEmail = req.user.email;
      try {
        const userPets = await petsCollection.find({ userEmail }).toArray();
        const petIds = userPets.map(pet => pet._id.toString());
        const adoptionRequests = await adoptionsCollection.find({ petId: { $in: petIds } }).toArray();
        res.json(adoptionRequests);
      } catch (error) {
        console.error('Error fetching adoption requests:', error);
        res.status(500).send(error);
      }
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
      if (existingUser) {
        return res.send({ message: 'user already exists', insertedId: null })
      }

      const result = await usersCollection.insertOne(user);
      res.status(201).send(result);
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

    app.post('/pets', verifyToken, async (req, res) => {
      try {
        const { petImage, petName, petAge, petCategory, petLocation, shortDescription, longDescription, dateAdded, adopted, userEmail } = req.body;

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
          userEmail
        };

        const result = await petsCollection.insertOne(newPet);
        res.status(201).send(result);
      } catch (error) {
        console.error('Error adding pet', error);
        res.status(500).send('Error adding pet');
      }
    });

    // creating donation campaigns
    app.post('/donation_campaigns', verifyToken, async (req, res) => {
      try {
        // Extract fields from request body
        const { petPicture, maxDonationAmount, lastDateOfDonation, shortDescription, longDescription, userEmail } = req.body;

        // Prepare data for creating donation campaign
        const newCampaign = {
          petPicture,
          maxDonationAmount,
          lastDateOfDonation,
          shortDescription,
          longDescription,
          createdAt: new Date(),
          userEmail
        };

        const result = await campaignsCollection.insertOne(newCampaign);

        // Return success response
        res.status(201).json({ message: 'Donation campaign created successfully', campaignId: result.insertedId });
      } catch (error) {
        console.error('Error creating donation campaign:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // ==========----- PATCH/PUT -----==========
    // PATCH (update) adoption status of a pet by ID
    app.patch('/pets/:id', verifyToken, async (req, res) => {
      const petId = req.params.id;
      const { adopted } = req.body;
      try {
        const result = await petsCollection.updateOne(
          { _id: new ObjectId(petId) },
          { $set: { adopted: adopted } }
        );
        if (result.matchedCount === 0) {
          return res.status(404).send('Pet not found');
        }
        res.status(204).send();
      } catch (error) {
        console.error('Error updating adoption status:', error);
        res.status(500).send('Internal Server Error');
      }
    });

    app.patch('/adoption_requests/:id', verifyToken, async (req, res) => {
      const requestId = req.params.id;
      const { status } = req.body; // status can be 'accepted' or 'rejected'
      try {
        const result = await adoptionsCollection.updateOne(
          { _id: new ObjectId(requestId) },
          { $set: { status } }
        );
        if (result.matchedCount === 0) {
          return res.status(404).send('Adoption request not found');
        }
        res.status(204).send();
      } catch (error) {
        console.error('Error updating adoption request status:', error);
        res.status(500).send('Internal Server Error');
      }
    });

    // ==========----- DELETE -----==========
    // DELETE a pet by ID
    app.delete('/pets/:id', verifyToken, async (req, res) => {
      const petId = req.params.id;
      try {
        const result = await petsCollection.deleteOne({ _id: new ObjectId(petId) });
        if (result.deletedCount === 0) {
          return res.status(404).send('Pet not found');
        }
        res.status(204).send();
      } catch (error) {
        console.error('Error deleting pet:', error);
        res.status(500).send('Internal Server Error');
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