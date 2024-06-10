require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
// console.log('Stripe Secret Key:', process.env.STRIPE_SECRET_KEY);
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://khalid-bin-ibrahim-a12.web.app',
    'https://khalid-bin-ibrahim-a12.firebaseapp.com',
    'https://khalid-bin-ibrahim-a12.netlify.app'
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
    const donatorsCollection = client.db("petsDB").collection("donators");

    // Middleware to check if the user is an admin
    const verifyAdmin = async (req, res, next) => {
      const userEmail = req.user.email;
      const user = await usersCollection.findOne({ email: userEmail });

      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied' });
      }

      next();
    };

    // ==========----- AUTH RELATED API -----==========

    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '6h' });

      res.send({
        message: 'Your access token successfully sent',
        token
      });
    });

    // ==========----- GET (ADMIN) -----==========
    // Get all users (Admin only)
    app.get('/admin/users', verifyToken, verifyAdmin, async (req, res) => {
      try {
        const users = await usersCollection.find().toArray();
        res.json(users);
      } catch (error) {
        res.status(500).send(error);
      }
    });

    app.get('/users/admin/:email', verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.user.email) {
        return res.status(403).send({ message: 'Forbidden access' })
      }

      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === 'admin';
      }
      res.send({ admin });
    });

    // get all donation campaigns
    app.get('/admin/all_campaigns', verifyToken, verifyAdmin, async (req, res) => {
      try {
        const campaigns = await campaignsCollection.find().toArray();
        res.json(campaigns);
      } catch (error) {
        console.error('Error fetching donation campaigns:', error);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });

    // GET all pets (protected)
    app.get('/admin/all_pets', verifyToken, verifyAdmin, async (req, res) => {
      try {
        const pets = await petsCollection.find().toArray();
        res.json(pets);
      } catch (error) {
        res.status(500).send(error);
      }
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

    // get currently logged in user pets
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

    // get currently logged in user adoption requests
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

    // get all donation campaigns
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

    // Get campaign details by ID
    app.get('/campaigns/:id', async (req, res) => {
      const { id } = req.params;

      try {
        const campaign = await campaignsCollection.findOne({ _id: new ObjectId(id) });
        if (!campaign) {
          return res.status(404).send({ error: 'Campaign not found' });
        }
        res.json(campaign);
      } catch (error) {
        console.error('Error fetching campaign details:', error);
        res.status(500).send({ error: 'Failed to fetch campaign details' });
      }
    });


    // get all donators data from database
    app.get('/donators', async (req, res) => {
      try {
        const donators = await donatorsCollection.find().toArray();
        res.json(donators);
      } catch (error) {
        res.status(500).send(error);
      }
    });

    // get currently logged in user donators
    app.get('/user_donations', verifyToken, async (req, res) => {
      const userEmail = req.user.email;

      try {
        const donations = await donatorsCollection.find({ user_email: userEmail }).toArray();
        res.json(donations);
      } catch (error) {
        res.status(500).send(error);
      }
    });


    // get currently logged in user donation campaigns
    app.get('/user_campaigns', verifyToken, async (req, res) => {
      const userEmail = req.user.email;
      try {
        const campaigns = await campaignsCollection.find({ userEmail }).sort({ createdAt: -1 }).toArray();
        res.json({ campaigns });
      } catch (error) {
        console.error('Error retrieving user donations:', error);
        res.status(500).send('Internal Server Error');
      }
    });

    // get recommended campaigns
    app.get('/recommended_campaigns', verifyToken, async (req, res) => {
      try {
        const recommendedCampaigns = await campaignsCollection
          .find({})
          .limit(3)
          .sort({ donated: -1 })
          .toArray();

        res.send(recommendedCampaigns);
      } catch (error) {
        console.error('Error fetching recommended campaigns:', error);
        res.status(500).send({ error: 'Failed to fetch recommended campaigns' });
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

    // add a adoption request
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

    // post a pet
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
        const { petName, petPicture, maxDonationAmount, lastDateOfDonation, shortDescription, longDescription, userEmail } = req.body;

        const newCampaign = {
          petName,
          petPicture,
          maxDonationAmount,
          lastDateOfDonation,
          shortDescription,
          longDescription,
          createdAt: new Date(),
          donatedAmount: 0,
          userEmail,
        };

        const result = await campaignsCollection.insertOne(newCampaign);
        res.status(201).json({ message: 'Donation campaign created successfully', campaignId: result.insertedId });
      } catch (error) {
        console.error('Error creating donation campaign:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // add donators data to the database
    app.post('/donations/donators/:id', verifyToken, async (req, res) => {
      const { id } = req.params;
      const { amount, paymentMethodId } = req.body;
      const userEmail = req.user.email;
      // console.log(userEmail, id);

      try {
        // Fetch the user details
        const user = await usersCollection.findOne({ email: userEmail });
        if (!user) {
          return res.status(404).send({ error: 'User not found' });
        }
        // console.log(user);

        // Fetch the donation details
        const donation = await campaignsCollection.findOne({ _id: new ObjectId(id) });
        if (!donation) {
          return res.status(404).send({ error: 'Donation not found' });
        }
        // console.log(donation);

        // Convert amount to cents
        const amountInCents = parseInt(amount * 100);

        // Create a payment intent with Stripe
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amountInCents,
          currency: 'usd',
          automatic_payment_methods: {
            enabled: true,
            allow_redirects: 'never'
          },
        });

        // Save the donator's information and update the donation
        const donator = {
          user_id: user._id,
          user_name: user.name,
          user_email: user.email,
          donation_id: donation._id,
          pet_name: donation.petName,
          amount: amountInCents,
          payment_intent_id: paymentIntent.id,
          date: new Date(),
        };

        await donatorsCollection.insertOne(donator);

        // Update the donation with the donated amount
        await campaignsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $inc: { donated: amountInCents } }
        );

        res.status(200).send({ success: true });
      } catch (error) {
        console.error('Error processing donation:', error);
        res.status(500).send({ error: 'Failed to process donation' });
      }
    });


    // ==========----- PATCH/PUT (ADMIN) -----==========
    // PATCH (update) to make a user an admin (Admin only)
    app.patch('/admin/make_admin/:id', verifyToken, verifyAdmin, async (req, res) => {
      const userId = req.params.id;
      try {
        const result = await usersCollection.updateOne(
          { _id: new ObjectId(userId) },
          { $set: { role: 'admin' } }
        );
        if (result.matchedCount === 0) {
          return res.status(404).send('User not found');
        }
        res.status(204).send();
      } catch (error) {
        console.error('Error making user admin:', error);
        res.status(500).send('Internal Server Error');
      }
    });

    // PATCH (update) to ban a user (Admin only)
    app.patch('/admin/ban_user/:id', verifyToken, verifyAdmin, async (req, res) => {
      const userId = req.params.id;
      try {
        const result = await usersCollection.updateOne(
          { _id: new ObjectId(userId) },
          { $set: { banned: true } }
        );
        if (result.matchedCount === 0) {
          return res.status(404).send('User not found');
        }
        res.status(204).send();
      } catch (error) {
        console.error('Error banning user:', error);
        res.status(500).send('Internal Server Error');
      }
    });

    // PATCH (update) to change pet's adoption status by ID (Admin only)
    app.patch('/admin/pets/:id', verifyToken, verifyAdmin, async (req, res) => {
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
        res.status(204).send(result);
      } catch (error) {
        console.error('Error updating adoption status:', error);
        res.status(500).send('Internal Server Error');
      }
    });

    // pause/unpause a donation campaign
    app.patch('/admin/campaigns/pause/:id', verifyToken, verifyAdmin, async (req, res) => {
      const campaignId = req.params.id;
      const { paused } = req.body;
      try {
        const result = await campaignsCollection.updateOne(
          { _id: new ObjectId(campaignId) },
          { $set: { paused: paused } }
        );
        if (result.matchedCount === 0) {
          return res.status(404).json({ error: 'Campaign not found' });
        }
        res.status(200).json({ message: `Donation campaign ${paused ? 'paused' : 'unpaused'} successfully` });
      } catch (error) {
        console.error('Error pausing/unpausing campaign:', error);
        res.status(500).json({ error: 'Internal Server Error' });
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
        res.status(204).send(result);
      } catch (error) {
        console.error('Error updating adoption status:', error);
        res.status(500).send('Internal Server Error');
      }
    });

    app.patch('/update_pets/:id', verifyToken, async (req, res) => {
      const petId = req.params.id;
      const petData = req.body;

      try {
        const query = { _id: new ObjectId(petId) };
        const update = { $set: petData };
        const result = await petsCollection.updateOne(query, update);

        if (result.matchedCount === 0) {
          return res.status(404).send({ error: 'Pet not found' });
        }

        res.send({ message: 'Pet updated successfully' });
      } catch (error) {
        console.error('Error updating pet:', error);
        res.status(500).send('Internal Server Error');
      }
    });

    // update an adoption request
    app.patch('/adoption_requests/:id', verifyToken, async (req, res) => {
      const requestId = req.params.id;
      const petId = req.query.petId;
      const { status } = req.body; // status can be 'accepted' or 'rejected'
      try {
        if (status === 'accepted') {
          await petsCollection.updateOne(
            { _id: new ObjectId(petId) },
            { $set: { adopted: true } }
          )
        } else {
          await petsCollection.updateOne(
            { _id: new ObjectId(petId) },
            { $set: { adopted: false } }
          )
        }
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

    // PATCH to pause/unpause a donation campaign
    app.patch('/donations/pause/:id', verifyToken, async (req, res) => {
      const donationId = req.params.id;
      try {
        const donation = await campaignsCollection.findOne({ _id: new ObjectId(donationId) });
        if (!donation) {
          return res.status(404).json({ message: 'Donation campaign not found' });
        }

        // Toggle the paused status
        const updatedPausedStatus = !donation.paused;
        await campaignsCollection.updateOne(
          { _id: new ObjectId(donationId) },
          { $set: { paused: updatedPausedStatus } }
        );

        res.status(200).json({ message: `Donation campaign ${updatedPausedStatus ? 'paused' : 'unpaused'} successfully` });
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    });

    // ==========----- DELETE (ADMIN) -----==========
    app.delete('/admin/delete_user/:id', verifyToken, verifyAdmin, async (req, res) => {
      const userId = req.params.id;
      try {
        const result = await usersCollection.deleteOne({ _id: new ObjectId(userId) });
        if (result.deletedCount === 0) {
          return res.status(404).send('User not found');
        }
        res.status(204).send(result);
      } catch (error) {
        console.error('Error deleting pet:', error);
        res.status(500).send('Internal Server Error');
      }
    });

    // DELETE a pet by ID (Admin only)
    app.delete('/admin/pets/:id', verifyToken, verifyAdmin, async (req, res) => {
      const petId = req.params.id;
      try {
        const result = await petsCollection.deleteOne({ _id: new ObjectId(petId) });
        if (result.deletedCount === 0) {
          return res.status(404).send('Pet not found');
        }
        res.status(204).send(result);
      } catch (error) {
        console.error('Error deleting pet:', error);
        res.status(500).send('Internal Server Error');
      }
    });

    // delete a donation campaign
    app.delete('/admin/campaigns/:id', verifyToken, verifyAdmin, async (req, res) => {
      const campaignId = req.params.id;
      try {
        const result = await campaignsCollection.deleteOne({ _id: new ObjectId(campaignId) });
        if (result.deletedCount === 0) {
          return res.status(404).json({ error: 'Campaign not found' });
        }
        res.status(204).send();
      } catch (error) {
        console.error('Error deleting campaign:', error);
        res.status(500).json({ error: 'Internal Server Error' });
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
        res.status(204).send(result);
      } catch (error) {
        console.error('Error deleting pet:', error);
        res.status(500).send('Internal Server Error');
      }
    });

    // Delete a donation (ask for refund)
    app.delete('/donations/:id', verifyToken, async (req, res) => {
      const donationId = req.params.id;
      const userEmail = req.user.email;

      try {
        const donation = await donatorsCollection.findOne({ _id: new ObjectId(donationId) });

        if (!donation) {
          return res.status(404).send({ error: 'Donation not found' });
        }

        if (donation.user_email !== userEmail) {
          return res.status(403).send({ error: 'You can only refund your own donations' });
        }

        const result = await donatorsCollection.deleteOne({ _id: new ObjectId(donationId) });

        res.send({ message: 'Donation refunded successfully', result });
      } catch (error) {
        res.status(500).send(error);
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