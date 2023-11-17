import express from 'express';
import debug from 'debug';
const debugUser = debug('app:User');
debugUser.color = '63';
import {findRoleByName,addUser, loginUser, newId,getAllUsers,getUserById, updateUser, saveEdit} from '../../database.js';
import bcrypt from 'bcrypt';
import { validBody } from '../../middleware/validBody.js';
import Joi from 'joi';
import jwt from 'jsonwebtoken';
import { validId } from '../../middleware/validId.js';
import { isLoggedIn, fetchRoles, mergePermissions, hasPermission } from '@merlin4/express-auth';

const router = express.Router();

async function issueAuthToken(user){
    const payload = {_id: user._id, email: user.email, role: user.role};
    const secret = process.env.JWT_SECRET;
    const options = {expiresIn:'1h'};


    const roles = await fetchRoles(user, role => findRoleByName(role));

    // roles.forEach(role => {
    //     debugUser(`The users role is ${(role.name)} and has the following permissions: ${JSON.stringify(role.permissions)}`);
    // });

    const permissions = mergePermissions(user, roles);
    payload.permissions = permissions;

    //debugUser(`The users permissions are ${permissions}`);

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

const updateUserSchema = Joi.object({
    fullName:Joi.string().trim().min(1).max(50),
    password:Joi.string().trim().min(8).max(50),
});

router.get('/list', isLoggedIn(), async (req, res) => {
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
        res.status(200).json({
            message:`Welcome ${resultUser.fullName}`,
            authToken:authToken,
            email:resultUser.email,
            fullName:resultUser.fullName,
        } );
    }else{
        res.status(401).json(`email or password incorrect`);
    }
});

router.post('/logout', isLoggedIn(), async (req,res) => {
    res.clearCookie('authToken');
    res.status(200).json({message:'Logged Out'});
});

//Self Service Update
router.put('/update/me', isLoggedIn(),validBody(updateUserSchema), async (req,res) => {
    debugUser(`Self Service Route Updating a user ${JSON.stringify(req.auth)}`);
    const updatedUser = req.body;
   
    try{
        const user = await getUserById(newId(req.auth._id));
        if(user){
            if(updatedUser.fullName){
                user.fullName = updatedUser.fullName;
            }
            if(updatedUser.password){
                user.password = await bcrypt.hash(updatedUser.password, 10);
            }
            const dbResult = await updateUser(user);
            if(dbResult.modifiedCount == 1){
                const edit ={
                    timeStamp: new Date(),
                    op:'Self-Edit Update User',
                    collection:'User',
                    target:user._id,
                    auth:req.auth
                }
                await saveEdit(edit);
                res.status(200).json({message: `User ${req.auth._id} updated`});
                return;
            }else{
                res.status(400).json({message: `User ${req.auth._id} not updated`});
                return;
            }
        }else{
            res.status(400).json({message: `User ${req.auth._id} not updated`});
        }
    }catch(err){
        res.status(500).json({error: err.stack});
    }
   
});


//Admin can update a user by the id
router.put('/update/:id', isLoggedIn(), validId('id'), validBody(updateUserSchema), async (req,res) => {
    debugUser('Admin Route Updating a user');
    const updatedUser = req.body;
    const user = await getUserById(req.id);
    //update user with updatedUser
    if(user){
        if(updatedUser.fullName){
            user.fullName = updatedUser.fullName;
        }
        if(updatedUser.password){
            user.password = await bcrypt.hash(updatedUser.password, 10);
        }
        const dbResult = await updateUser(user);
        if(dbResult.modifiedCount == 1){
            const edit ={
                timeStamp: new Date(),
                op:'Admin Update User',
                collection:'User',
                target:user._id,
                auth:req.auth
            }
            await saveEdit(edit);
            res.status(200).json({message: `User ${req.id} updated`});
            return;
        }else{
            res.status(400).json({message: `User ${req.id} not updated`});
            return;
        }
    }else{
        res.status(400).json({message: `User ${req.id} not updated`});
    }
});


export {router as UserRouter}