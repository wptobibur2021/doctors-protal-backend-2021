// Require File Decalration Below.........
const { MongoClient } = require('mongodb');
const express = require('express')
const admin = require("firebase-admin");
require('dotenv').config()
const app = express()
const cors = require('cors')
const fileUpload = require('express-fileupload')
//MIDDLEWARE
app.use(cors())
app.use(express.json())
app.use(fileUpload())
// Backend Server Start Prot
const port = process.env.PORT || 8000
// ID No Find
const objectId = require('mongodb').ObjectId
//Backend Firebase Config
const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_ACCOUNT);
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
// JWT Token Verify Methods
async function verifyToken(req, res, next) {
    if(req.headers?.authorization?.startsWith('Bearer ')){
        const userToken = req.headers.authorization.split(' ')[1]
        try{
            const decodedUser = await admin.auth().verifyIdToken(userToken)
            req.decodedUserEmail = decodedUser.email
        }catch (e) {

        }
    }
    next()
}
// Payment Methods Stripe Secret
const stripe = require('stripe')(process.env.STRIPE_SECRET)

// Database Info
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@doctorsprotal.qpua2.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function doctorDB(){
    try{
        await client.connect()
        const database = client.db('doctorsPortal')
        const appointmentCollection = database.collection('appointment')
        const userCollection = database.collection('users')
        const doctorCollection = database.collection('doctors')
        //User Get API Appointments
        app.get('/api/user/appointments', async (req,res)=>{
            const email = req.query.email
            const date = new Date(req.query.date).toLocaleDateString()
            const query = {email: email, date: date}
            let result
            if(query){
                result = await appointmentCollection.find(query).toArray()
            }else{
                result = await appointmentCollection.find({email: email}).toArray()
            }
            await res.json(result)
        })
        //Post API Book Appointment
        app.post('/api/book-appointment', verifyToken,async (req,res)=>{
            const allData = req.body
            const result = await appointmentCollection.insertOne(allData)
            await res.json(result)
        })

        // PUT API Update Appointment
        app.put('/api/book-appointment/:id', async (req,res)=>{
            const id = req.params.id;
            const payment = req.body
            const query = {_id: objectId(id)}
            const updateDoc = {
                $set:{
                    payment: payment
                }
            }
            const result = await appointmentCollection.updateOne(query,updateDoc)
            res.json(result)
        })
        // New User API
        app.post('/api/new-user-info', async (req,res)=>{
            const newUser = req.body
            const result = await userCollection.insertOne(newUser)
            await res.json(result)
        })
        // Update New user Info
        app.put('/api/new-user-info', async (req,res)=>{
            const newUser = req.body
            const filter = {email: newUser.email}
            const options = { upsert: true };
            const updateDoc = {$set: newUser}
            const result = await userCollection.updateOne(filter,updateDoc,options)
            await res.json(result)
        })
        //Make Admin
        app.put('/api/users/admin', verifyToken, async (req,res)=>{
            const user = req.body
            const requester = req.decodedUserEmail
            if(requester){
                const requesterAccount = await userCollection.findOne({email: requester})
                if(requesterAccount.role === 'admin'){
                    const filter = {email: user.email}
                    const updateDoc = {$set: {role: 'admin'}}
                    const result = await userCollection.updateOne(filter,updateDoc)
                    await res.json(result)
                }
            }else{
                res.send(403).json({message: 'You can not create admin'})
            }
        })

        // Get Make Admin info
        app.get('/api/user/admin/:email', async (req,res) =>{
            const email = req.params.email
            const query = {email: email}
            const result = await userCollection.findOne(query)
            let isAdmin = false
            if(result?.role === 'admin' ){
                isAdmin = true
            }
            await res.json({admin: isAdmin})
        })
        //GET APPOINTMENT BY ID
        app.get('/api/appointment/:id', async (req,res)=>{
            const id = req.params.id
            console.log('Id:' ,id)
            const query = {_id: objectId(id)}
            const result = await appointmentCollection.findOne(query)
            console.log('Result: ', result)
            await res.json(result)
        })
        //CREATE PAYMENT INTENT
        app.post('/create-payment-intent', async (req,res)=>{
            const paymentInfo = req.body
            const amount = paymentInfo.price * 100
            const paymentIntent = await stripe.paymentIntents.create({
                currency: 'usd',
                amount,
                payment_method_types: ['card'],
            })
            res.json({clientSecret: paymentIntent.client_secret})
        })
        // ADD DOCTORS INFORMATION
        app.post('/api/add-doctor', async (req,res)=>{
            const name = req.body.fullName;
            const email = req.body.email;
            const mobile = req.body.mobile
            const pic = req.files.image
            const picData = pic.data
            const encodedPic = picData.toString('base64');
            const imageBuffer = Buffer.from(encodedPic, "base64")
            const doctor = {
                name,
                email,
                mobile,
                image: imageBuffer
            }
            const result = await doctorCollection.insertOne(doctor)
            res.json(result)
        })
        // GET DOCTORS
        app.get('/api/all-doctors', async (req,res)=>{
            const desc= {name: -1}
            const allDoctors = doctorCollection.find({}).sort(desc)
            const result = await allDoctors.limit(8).toArray()
            res.json(result)
        })

    }finally {

    }
}
doctorDB().catch(console.dir)







// Root Get API
app.get('/', async (req, res)=>{
    await res.send('Backend Server ok')
})
app.listen(port, () =>{
    console.log(`'Backend Server Start at http://localhost:${port}`)
})
