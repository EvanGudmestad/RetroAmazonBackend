import express from 'express';
import debug from 'debug';
const debugBook = debug('app:Book');
import { connect,getBooks, getBookById, updateBook, addBook, deleteBook, saveEdit } from '../../database.js';
import { validId } from '../../middleware/validId.js';
import {validBody} from '../../middleware/validBody.js';
import Joi from 'joi';
import { isLoggedIn, hasPermission } from '@merlin4/express-auth';

const router = express.Router();

const newBookSchema = Joi.object({
    isbn:Joi.string().trim().min(14).required(),
    title:Joi.string().trim().min(1).required(),
    author:Joi.string().trim().min(1).required(),
    genre:Joi.string().valid('Fiction', 'Magical Realism', 'Dystopian', 'Mystery', 'Young Adult', 'Non-Fiction').required(),
    publication_year:Joi.number().integer().min(1900).max(2023).required(),
    price:Joi.number().min(0).required(),
    description:Joi.string().trim().min(1).required(),
});

const updateBookSchema = Joi.object({
    isbn:Joi.string().trim().min(14),
    title:Joi.string().trim().min(1),
    author:Joi.string().trim().min(1),
    genre:Joi.string().valid('Fiction', 'Magical Realism', 'Dystopian', 'Mystery', 'Young Adult', 'Non-Fiction'),
    publication_year:Joi.number().integer().min(1900).max(2023),
    price:Joi.number().min(0),
    description:Joi.string().trim().min(1),
});

//get all books
router.get('/list', isLoggedIn(), async (req, res) => {

    debugBook(`The req.auth property is: ${JSON.stringify(req.auth)}`);
 
    debugBook(`The req.auth property is: ${JSON.stringify(req.auth)}`);
    let {keywords, minPrice,maxPrice, genre, sortBy, pageSize, pageNumber} = req.query;
    const match = {}; //match stage of the aggregation pipeline is the filter similar to the where clause in SQL
    let sort = {author:1}; //default sort stage will sort by author ascending

    //skip and limit stages together help create pagination
    //skip will skip the first n documents
    //limit will limit the number of documents returned


    try
    {
        // const db = await connect();
        // const books = await getBooks();
        // res.status(200).json(books);

        if(keywords){
            match.$text = {$search: keywords};
        }

        if(genre){
            match.genre = {$eq: genre};
        }

        if(minPrice && maxPrice){
            match.price = {$gte: parseFloat(minPrice), $lte: parseFloat(maxPrice)};
        }else if(minPrice){
            match.price = {$gte: parseFloat(minPrice)};
        }else if(maxPrice){
            match.price = {$lte: parseFloat(maxPrice)};
        }

        switch(sortBy){
            case "price": sort = {price : 1}; break;
            case "year" : sort = {publication_year: 1}; break;
        }

       // debugBook(`Sort is ${JSON.stringify(sort)}`);

        pageNumber = parseInt(pageNumber) || 1;
        pageSize = parseInt(pageSize) || 100;
        const skip = (pageNumber - 1) * pageSize;
        const limit = pageSize;
        debugBook(`Skip is ${skip} and limit is ${limit}`);
        const pipeline = [
            {$match: match},
            {$sort: sort},
            {$skip: skip},
            {$limit: limit}
        ];

        const db = await connect();
        const cursor = await db.collection('Book').aggregate(pipeline);
        const books = await cursor.toArray();
        res.status(200).json(books);

    } catch(err){
        res.status(500).json({error: err.stack});
    }

  
});

//get a book by the id
router.get('/:id', isLoggedIn(), validId('id'), async (req,res) => {
    const id = req.id;
    try{
        const book = await getBookById(id);
        if(book){
            res.status(200).json(book);
        }else{
            res.status(404).json({message: `Book ${id} not found`});
        }
    } catch(err){
        res.status(500).json({error: err.stack});
    }
});

//update a book by the id
//update can use a put or a post
router.put('/update/:id', isLoggedIn(), validId('id'), validBody(updateBookSchema), async (req,res) => {
    const id = req.id;
    const updatedBook = req.body;
    if(updatedBook.price){
        updatedBook.price = parseFloat(updatedBook.price);
    }
   try{
        const updateResult = await updateBook(id, updatedBook);
        debugBook(`Update result is ${JSON.stringify(updateResult)}`);
        if(updateResult.modifiedCount == 1){
            const edit ={
                timeStamp: new Date(),
                op:'Update Book',
                collection:'Book',
                target:id,
                auth:req.auth
            }
            await saveEdit(edit);
            res.status(200).json({message: `Book ${id} updated`});
        }else{
            res.status(400).json({message: `Book ${id} not updated`});
        }
    }catch(err){
        res.status(500).json({error: err.stack});
    }
});


//add a new book to the Mongo Atlas database
router.post('/add', isLoggedIn(), validBody(newBookSchema), async (req,res) => {
    //req is the request object
    const newBook = req.body;
   
    try{
        const dbResult = await addBook(newBook);
        if(dbResult.acknowledged == true){
            res.status(200).json({message: `Book ${newBook.title} added with an id of ${dbResult.insertedId}`});
        }else{
            res.status(400).json({message: `Book ${newBook.title} not added`});
        }
    } catch(err){
     res.status(500).json({error: err.stack});
    }
});

//delete a book by the id
router.delete('/delete/:bookId', isLoggedIn(), validId('bookId'), async (req,res) => {
    //gets the id from the URL
    const id = req.bookId;

    try{
        const dbResult = await deleteBook(id);

        if(dbResult.deletedCount == 1){
            res.status(200).json({message: `Book ${id} deleted`});
        }else{
            res.status(400).json({message: `Book ${id} not deleted`});
        }
    }catch(err){
        res.status(500).json({error: err.stack});
    }

});

export {router as BookRouter};