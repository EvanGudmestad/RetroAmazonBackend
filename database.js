import { MongoClient, ObjectId } from "mongodb";

import debug from "debug";
const debugDatabase = debug("app:Database");

let _db = null;

const newId = (str) => new ObjectId(str);

async function connect(){
    if(!_db){
        const connectionString = process.env.DB_URL;
        const dbName = process.env.DB_NAME;
        const client = await MongoClient.connect(connectionString);
        _db = client.db(dbName);
    }
    return _db;
}

async function ping(){
    const db = await connect();
    await db.command({ ping: 1 });
    debugDatabase("Pinged your deployment. You successfully connected to MongoDB!");
}


async function getBooks(){
    const db = await connect();
    //MongoSH command to find all books: db.books.find({})
    //find() returns a cursor, which is a pointer to the result set of a query.
    const books = await db.collection("Book").find().toArray();
    
    const bufferToBase64 = (buffer) => {
            return buffer.toString('base64');
        };
    // Iterate over each book and convert imageFile.data to Base64
    const booksWithImages = books.map(book => {
        if (book.imageFile && book.imageFile.data) {
            book.imageFile.base64 = bufferToBase64(book.imageFile.data);
            // Optionally delete the binary data if you don't need it on the frontend
            // delete book.imageFile.data;
        }
        return book;
    });
    //console.log(books);
    return booksWithImages;
}

async function getBookById(id){
    const db = await connect();
    const book = await db.collection("Book").findOne({_id: new ObjectId(id)});
    return book;
}

async function addBook(book){
    const db = await connect();
    const result = await db.collection("Book").insertOne(book);
    debugDatabase(result.insertedId);
    return result;
}

async function updateBook(id, updatedBook){
    const db = await connect();
    const result = await db.collection("Book").updateOne({_id:new ObjectId(id)},{$set:{...updatedBook}});
    return result;
}

async function deleteBook(id){
    const db = await connect();
    const result = await db.collection("Book").deleteOne({_id:new ObjectId(id)});
    return result;
}

async function addUser(user){
    const db = await connect();
    user.role = ['customer'];
    const result = await db.collection("User").insertOne(user);
    //debugDatabase(result.insertedId);
    return result;
}

async function loginUser(user){
    const db = await connect();
    const resultUser = await db.collection("User").findOne({email: user.email});
    return resultUser;
}

async function getAllUsers(){
    const db = await connect();
    const users = await db.collection("User").find().toArray();
    return users;
}

async function getUserById(id){
    const db = await connect();
    const user = await db.collection("User").findOne({_id: id});
    return user;
}

async function updateUser(user){
    const db = await connect();
    const result = await db.collection("User").updateOne({_id:user._id},{$set:{...user}});
    return result;
}

async function saveEdit(edit){
    const db = await connect();
    const result = await db.collection("Edit").insertOne(edit);
    return result;
}

async function findRoleByName(name){
    const db = await connect();
    const role = await db.collection("Role").findOne({name:name});
    return role;
}

// async function insertBookImage(image){
//     const db = await connect();
//     const result = await db.collection("BookImage").insertOne(image);
//     return result;
// }

//ping();


export {findRoleByName,connect, ping, getBooks, getBookById, addBook, updateBook, deleteBook, addUser, loginUser, newId,getAllUsers, getUserById, updateUser, saveEdit}

