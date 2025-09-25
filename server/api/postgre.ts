// import pg from 'pg';
// import { ref } from 'vue';

// const res = ref(null);

// const client = new pg.Client({
//   user: '',
//   host: '',
//   database: '',
//   password: '',
//   port: ,
// });

// const connectToDatabase = async () => {
//   try {
//     await client.connect();
//     console.log('Connected to PostgreSQL');
//   } catch (err) {
//     console.error('Error connecting to PostgreSQL:', err);
//   }
// };

// const queryDatabase = async () => {
//   try {
//     const queryResult = await client.query('SELECT * FROM public.signal');
//     res.value = queryResult.rows;
//     console.log('Query result:', res.value);
//   } catch (err) {
//     console.error('Error executing query:', err);
//   } finally {
//     await client.end();
//     console.log('The connection is closed');
//   }
// };

// connectToDatabase()
//   .then(() => {
//     queryDatabase();
//   });

// export default res;