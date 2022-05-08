const express = require('express');
const cors = require('cors');
const fileUpload = require('express-fileupload')
var admin = require("firebase-admin");
const ObjectId = require('mongodb').ObjectId;
var serviceAccount = require("./doctors-portal-firebase-adminsdk.json");
const { MongoClient, ServerApiVersion } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;
app.use(cors())
app.use(express.json())
app.use(fileUpload())
require('dotenv').config();
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.znysc.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const stripe = require('stripe')(process.env.STRIPE_SECRATE)
async function verifyToken(req,res,next){
  if(req.headers?.authorization?.startsWith('Bearer ')){
    const token = req.headers.authorization.split(' ')[1]
    const decodedUser = await admin.auth().verifyIdToken(token);
    req.decodedEmail = decodedUser.email;
  }
  next();
}

async function run() {
    try {
      // Connect the client to the server
      await client.connect();
      // Establish and verify connection
      const database = client.db('doctors_protals');
      const appointmentCollection = database.collection('appointment');
      const usersCollection = database.collection('users');
      const doctorsCollection = database.collection('doctors');
      app.get('/appointments',verifyToken,async(req,res)=>{
        const email = req.query.email;
        const date = req.query.date;
        const query = {email:email , date:date}
        const appointment = appointmentCollection.find(query);
        const result = await appointment.toArray()
        res.send(result)
      })
      app.post('/appointments',async(req,res)=>{
        const appointment = req.body;
        const result = await appointmentCollection.insertOne(appointment);
        res.json(result)
      });
      app.post('/users',async(req,res)=>{
        const user = req.body;
        const result = await usersCollection.insertOne(user);
        res.json(result)
      });
      app.put('/users',async(req,res)=>{
        const user = req.body;
        const filter = { email: user.email };
        const options = { upsert: true };
        const updateDoc = {
          $set: user
        };
        const result = await usersCollection.updateOne(filter,updateDoc,options);
        res.json(result);
      });
      app.put('/users/admin',verifyToken,async(req,res)=>{
        const email = req.body.email;
        const requester = req.decodedEmail;
        if(requester){
          const requesterAccount = await usersCollection.findOne({email:requester})
          if(requesterAccount.role === 'admin'){
            const filter = {email: email};
            const updateDoc = {$set:{role:'admin'}}
            const result = await usersCollection.updateOne(filter,updateDoc)
            res.json(result)
          }
        }else{
          res.status(401).json({message:'You do not have access to admin'});
        }
        
      });
      app.post('/doctors',async(req,res)=>{
        const name = req.body.name;
        const email = req.body.email;
        const pic = req.files.image;
        const picData = pic.data;
        const encodedPic = picData.toString('base64');
        const imageBuffer = Buffer.from(encodedPic,'base64')
        const doctor = {
          name,
          email,
          image: imageBuffer
        }
        const result = await doctorsCollection.insertOne(doctor);
        res.json(result);
      });
      app.get('/doctors',async(req,res)=>{
        const cursor = doctorsCollection.find({});
        const doctors = await cursor.toArray();
        res.json(doctors);
      })
      app.get('/users/:email',async(req,res)=>{
        const email = req.params.email;
        const query = {email:email};
        const user = await usersCollection.findOne(query);
        let isAdmin = false;
        if(user?.role === 'admin'){
          isAdmin= true
        }
        res.json({admin:isAdmin})
      });
      app.get('/appointment/:id',async(req,res)=>{
        const id = req.params.id;
        const query = {_id:ObjectId(id)}
        const result = await appointmentCollection.findOne(query);
        res.json(result);
      });

      app.post('/create-payment-intent',async(req,res)=>{
        const paymentInfo = req.body;
        const amount = paymentInfo.price * 100;
        const paymentIntent = await stripe.paymentIntents.create({
          currency: "usd",
          amount: amount,
          payment_method_types: ['card']
        });
        res.json({clientSecrate:paymentIntent.client_secret})
      });
      // appintmentpayment
      app.put('/appointmentpayment/:id',async(req,res)=>{
        const id = req.params.id;
        const payment   = req.body;
        const filter = { _id:ObjectId(id)};
        const updateDoc = {
          $set:{payment:payment}
        }
        const result = await appointmentCollection.updateOne(filter,updateDoc);
        res.json(result);
      })
    } finally {
      // Ensures that the client will close when you finish/error
      // await client.close();
    }
  }
  run().catch(console.dir);
app.get('/',(req,res)=>{
    res.send('Doctors portal')
})
app.listen(port,()=>{
    console.log('Running Port ',port)
})