const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors'); 

const app = express();
const port = 3003;

app.use(cors());
app.use(express.json());

const pool = mysql.createPool({
  host: 'bogor.gusti.id',
  user: 'pusatttt_uastian',
  password: 'pusatttt_uastian',
  database: 'pusatttt_uastian',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

const bersihinJudul = (title) => title.replace(/[^\w\s\(\)]/gi, '');
const validasiTanggal = (tanggal) => !isNaN(new Date(tanggal).getTime());
const validasiDurasi = (durasi) => /\d+\s*min/.test(durasi) ? durasi : '--:--';

const executeQuery = async (query, params = []) => {
  try {
    const [rows] = await pool.execute(query, params);
    return rows;
  } catch (err) {
    throw new Error('Terjadi kesalahan saat menjalankan query database');
  }
};

const ambilFilm = async (page = 1, limit = 20) => {
  const offset = (page - 1) * limit;
  const query = `
    SELECT title, movie_id, video_type, link, slug, thumbnail, rating, duration
    FROM movies
    ORDER BY id DESC
    LIMIT ? OFFSET ?`;

  const movies = await executeQuery(query, [limit, offset]);
  return movies.map(({ title, movie_id, video_type, link, slug, thumbnail, rating, duration }) => ({
    title: bersihinJudul(title),
    movie_id,
    video_type,
    thumbnail: link + thumbnail,
    slug,
    rating,
    duration: validasiDurasi(duration),
  }));
};

const ambilFilmBerdasarkanSlug = async (slug) => {
  const query = `
    SELECT * FROM movies WHERE slug = ?`;

  const [rows] = await pool.execute(query, [slug]);
  if (rows.length === 0) throw new Error('Film tidak ditemukan!');

  const movie = rows[0];
  return {
    movie_id: movie.movie_id,
    title: bersihinJudul(movie.title),
    video_type: movie.video_type,
    rating: movie.rating,
    duration: validasiDurasi(movie.duration),
    thumbnail: movie.link + movie.thumbnail,
    slug: movie.slug,
    description: movie.description,
    genre: movie.genre,
    release_date: validasiTanggal(movie.release_date) ? new Date(movie.release_date).toLocaleDateString('id-ID') : '-/-/-',
    actors: movie.actors,
    directors: movie.directors,
    quality: movie.quality,
    countries: movie.countries,
    keywords: movie.keywords,
    video_url: movie.video_url,
  };
};

const tambahFilm = async (movieData) => {
  const query = `
    INSERT INTO movies (title, movie_id, video_type, link, slug, thumbnail, rating, duration, description, genre, release_date, actors, directors, quality, countries, keywords, video_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  const [result] = await pool.execute(query, Object.values(movieData));
  return result.insertId;
};

const updateFilm = async (slug, movieData) => {
  const query = `
    UPDATE movies
    SET title = ?, movie_id = ?, video_type = ?, link = ?, slug = ?, thumbnail = ?, rating = ?, duration = ?, description = ?, genre = ?, release_date = ?, actors = ?, directors = ?, quality = ?, countries = ?, keywords = ?, video_url = ?
    WHERE slug = ?`;

  const [result] = await pool.execute(query, [...Object.values(movieData), slug]);
  return result.affectedRows > 0;
};

const deleteFilm = async (slug) => {
  const query = `
    DELETE FROM movies WHERE slug = ?`;

  const [result] = await pool.execute(query, [slug]);
  return result.affectedRows > 0;
};

app.get('/movies', async (req, res) => {
  const startTime = Date.now();

  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const movieList = await ambilFilm(page, limit);

    const totalMovies = await executeQuery('SELECT COUNT(*) AS total FROM movies');
    const responseTime = (Date.now() - startTime) / 1000;

    res.json({
      status: 'ok',
      message: 'Data film berhasil diambil',
      pagination: {
        current_page: page,
        total_pages: Math.ceil(totalMovies[0].total / limit),
        total_items: totalMovies[0].total,
        limit,
      },
      response_time: `${responseTime.toFixed(3)}s`,
      dev_info: 'Versi API 1.0.0, Dikembangkan oleh TiannDev',
      data: movieList,
    });
  } catch (err) {
    const responseTime = (Date.now() - startTime) / 1000;
    res.status(500).json({
      status: 'error',
      message: 'Terjadi kesalahan di server',
      error: err.message,
      response_time: `${responseTime.toFixed(3)}s`,
      dev_info: 'Versi API 1.0.0, Dikembangkan oleh TiannDev',
    });
  }
});

app.get('/movies/:slug', async (req, res) => {
  const startTime = Date.now();

  try {
    const movie = await ambilFilmBerdasarkanSlug(req.params.slug);
    const responseTime = (Date.now() - startTime) / 1000;

    res.json({
      status: 'ok',
      message: 'Data film ditemukan',
      response_time: `${responseTime.toFixed(3)}s`,
      dev_info: 'Versi API 1.0.0, Dikembangkan oleh TiannDev',
      data: movie,
    });
  } catch (err) {
    const responseTime = (Date.now() - startTime) / 1000;
    res.status(404).json({
      status: 'error',
      message: err.message,
      response_time: `${responseTime.toFixed(3)}s`,
      dev_info: 'Versi API 1.0.0, Dikembangkan oleh TiannDev',
    });
  }
});

app.post('/movies', async (req, res) => {
  try {
    const movieData = req.body;
    const insertId = await tambahFilm(movieData);
    res.status(201).json({
      status: 'ok',
      message: 'Film berhasil ditambahkan',
      movie_id: insertId,
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: 'Terjadi kesalahan saat menambahkan film',
      error: err.message,
    });
  }
});

app.put('/movies/:slug', async (req, res) => {
  try {
    const updated = await updateFilm(req.params.slug, req.body);

    if (updated) {
      res.json({
        status: 'ok',
        message: 'Film berhasil diperbarui',
      });
    } else {
      res.status(404).json({
        status: 'error',
        message: 'Film tidak ditemukan',
      });
    }
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: 'Terjadi kesalahan saat memperbarui film',
      error: err.message,
    });
  }
});

app.delete('/movies/:slug', async (req, res) => {
  try {
    const deleted = await deleteFilm(req.params.slug);

    if (deleted) {
      res.json({
        status: 'ok',
        message: 'Film berhasil dihapus',
      });
    } else {
      res.status(404).json({
        status: 'error',
        message: 'Film tidak ditemukan',
      });
    }
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: 'Terjadi kesalahan saat menghapus film',
      error: err.message,
    });
  }
});

app.listen(port, () => {
  console.log(`Server berjalan di http://localhost:${port}`);
});