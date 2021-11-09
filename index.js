const express = require('express')
const { MongoClient } = require('mongodb');
require('dotenv').config()
const cors = require('cors')
const ObjectId = require('mongodb').ObjectId
const app = express()
const port = process.env.PORT || 5000
const admin = require("firebase-admin");
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

app.use(cors())
app.use(express.json())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.egg9z.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function verifyToken(req, res, next) {

    if (req.headers.authorization?.startsWith('Bearer ')) {
        const token = req.headers.authorization.split(' ')[1]
        try {
            const decodedUser = await admin.auth().verifyIdToken(token)
            req.decodedEmail = decodedUser.email
        } catch {

        }
    }
    next()
}

async function run() {

    try {

        await client.connect()
        const database = client.db('doctors-portal-database')
        const apointmentsCollection = database.collection('appointments')
        const usersCollection = database.collection('users')

        app.post('/appointments', async (req, res) => {

            const appointment = req.body
            const result = await apointmentsCollection.insertOne(appointment)
            res.json(result)

        })

        app.get('/appointments', verifyToken, async (req, res) => {
            const requester = req.decodedEmail
            const email = req.query.email
            const date = new Date(req.query.date).toLocaleDateString()
            if (requester === email) {
                const query = { email: email, date: date }
                const cursor = apointmentsCollection.find(query)
                const appointments = await cursor.toArray()
                res.json(appointments)
            }
        })

        app.get('/users/:email', async (req, res) => {
            const email = req.params.email
            const query = { email: email }
            const user = await usersCollection.findOne(query)
            let isAdmin = false
            if (user?.role == 'admin') {
                isAdmin = true
            }
            res.json({ admin: isAdmin })
        })

        app.post('/users', async (req, res) => {
            const user = req.body
            const result = await usersCollection.insertOne(user)
            res.json(result)
        })

        app.put('/users', async (req, res) => {
            const user = req.body
            const filter = { email: user.email }
            const options = { upsert: true };
            const updateDoc = {
                $set: user
            }
            const result = await usersCollection.updateOne(filter, updateDoc, options);
            res.json(result)

        })
        app.put('/users/admin', verifyToken, async (req, res) => {

            const user = req.body
            const requester = req.decodedEmail
            if (requester) {
                const requesterAccount = await usersCollection.findOne({ email: requester })
                if (requesterAccount.role === 'admin') {
                    const filter = { email: user.email }
                    const updateDoc = {
                        $set: { role: 'admin' }
                    }
                    const result = await usersCollection.updateOne(filter, updateDoc);
                    res.json(result)

                } else {
                    res.status(403).json({ message: 'you dont have that access' })
                }
            }

        })

    } finally {
        //await client.close
    }
}


app.get('/', (req, res) => {
    res.send('Hello Doctors Portal!')
})

app.listen(port, () => {
    console.log(`listening at ${port}`)
})

run().catch(console.dir)