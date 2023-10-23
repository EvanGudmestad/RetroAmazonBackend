import express from 'express';
import debug from 'debug';
const debugUser = debug('app:User');
debugUser.color = '63';
import {addUser, loginUser, newId,getAllUsers} from '../../database.js';
import bcrypt from 'bcrypt';
import { validBody } from '../../middleware/validBody.js';
import Joi from 'joi';
import jwt from 'jsonwebtoken';

const router = express.Router();

async function issueAuthToken(user){
    const payload = {_id: user._id, email: user.email, role: user.role};
    const secret = process.env.JWT_SECRET;
    const options = {expiresIn:'1h'};

    const authToken = jwt.sign(payload, secret, options);
    return authToken;
}

function issueAuthCookie(res, authToken){
    const cookieOptions = {httpOnly:true,maxAge:1000*60*60};
    res.cookie('authToken',authToken,cookieOptions);
}

//step 1: define new user schema
const newUserSchema = Joi.object({
    fullName:Joi.string().trim().min(1).max(50).required(),
    password:Joi.string().trim().min(8).max(50).required(),
    email:Joi.string().trim().email().required(),
});

const loginUserSchema = Joi.object({
    email:Joi.string().trim().email().required(),
    password:Joi.string().trim().min(8).max(50).required()
});

router.get('/list', async (req, res) => {
    debugUser('Getting all users');
    try{
        let users = await getAllUsers();

        res.status(200).json(users);
    }catch(err){
        res.status(500).json({error: err.stack});
    }
});

router.post('/add', validBody(newUserSchema), async (req,res) => {
    const newUser = 
    {
        _id: newId(),
        ...req.body,
        createdDate: new Date(),
    }
    
    newUser.password = await bcrypt.hash(newUser.password, 10);
    try{
        const result = await addUser(newUser);
       if(result.acknowledged==true){
            //Ready to create the cookie and JWT Token
            const authToken = await issueAuthToken(newUser);
            issueAuthCookie(res, authToken);

            res.status(200).json({message: `User ${result.insertedId} added.  Your auth token is ${authToken}`});
       }
    }catch(err){
        res.status(500).json({error: err.stack});
    }
});

router.post('/login', validBody(loginUserSchema), async (req,res) => {
    const user = req.body;

    const resultUser = await loginUser(user);
    debugUser(resultUser);
    if(resultUser && await bcrypt.compare(user.password, resultUser.password)){
        const authToken = await issueAuthToken(resultUser);
        issueAuthCookie(res, authToken);
        res.status(200).json(`Welcome ${resultUser.fullName}.  Your auth token is ${authToken}`);
    }else{
        res.status(401).json(`email or password incorrect`);
    }
});

export {router as UserRouter}