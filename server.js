const express = require('express');
const cors = require('cors');
var admin = require("firebase-admin");
var serviceAccount = require("./doctors-portal-firebase-adminsdk.json");
const { MongoClient, ServerApiVersion } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;
app.use(cors())
app.use(express.json())
require('dotenv').config();
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.znysc.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

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
      app.get('/users/:email',async(req,res)=>{
        const email = req.params.email;
        const query = {email:email};
        const user = await usersCollection.findOne(query);
        let isAdmin = false;
        if(user?.role === 'admin'){
          isAdmin= true
        }
        res.json({admin:isAdmin})
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