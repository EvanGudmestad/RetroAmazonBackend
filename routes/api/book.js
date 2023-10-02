import express from 'express';
import debug from 'debug';
const debugBook = debug('app:Book');
import { connect,getBooks, getBookById, updateBook, addBook, deleteBook } from '../../database.js';

const router = express.Router();

//get all books
router.get('/list', async (req, res) => {
    debugBook('Getting all books');
    try
    {
        const db = await connect();
        const books = await getBooks();
        res.status(200).json(books);
    } catch(err){
        res.status(500).json({error: err.stack});
    }

  
});

//get a book by the id
router.get('/:id', async (req,res) => {
    const id = req.params.id;
    try{
        const book = await getBookById(id);
        res.status(200).json(book);
    } catch(err){
        res.status(500).json({error: err.stack});
    }
});

//update a book by the id
//update can use a put or a post
router.put('/update/:id', async (req,res) => {
    const id = req.params.id;
    const updatedBook = req.body;
    if(updatedBook.price){
        updatedBook.price = parseFloat(updatedBook.price);
    }
   try{
        const updateResult = await updateBook(id, updatedBook);
        if(updateResult.modifiedCount == 1){
            res.status(200).json({message: `Book ${id} updated`});
        }else{
            res.status(400).json({message: `Book ${id} not updated`});
        }
    }catch(err){
        res.status(500).json({error: err.stack});
    }
});


//add a new book to the Mongo Atlas database
router.post('/add', async (req,res) => {
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
router.delete('/delete/:id', async (req,res) => {
    //gets the id from the URL
    const id = req.params.id;

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