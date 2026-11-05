const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const app = require("../src/app");
const Pelicula = require("../src/models/Pelicula");

let mongod;

const base = { anio: 2000, director: { nombre: "Director Test" } };
const datos = [
  { titulo: "Toy", generos: ["Animación", "Comedia"], nota: 9 },
  { titulo: "Coco", generos: ["Animación"], nota: 8 },
  { titulo: "Padrino", generos: ["Drama"], nota: 9 },
  { titulo: "Forrest", generos: ["Drama", "Comedia"], nota: 8 },
  { titulo: "Joker", generos: ["Drama", "Acción"], nota: 7 },
  { titulo: "Mad Max", generos: ["Acción"], nota: 5 },
  { titulo: "Django", generos: ["Western"], nota: 10 },
].map((p) => ({ ...base, ...p }));

const esperado = [
  { genero: "Western", total: 1, notaMedia: 10 },
  { genero: "Animación", total: 2, notaMedia: 8.5 },
  { genero: "Comedia", total: 2, notaMedia: 8.5 },
  { genero: "Drama", total: 3, notaMedia: 8 },
  { genero: "Acción", total: 2, notaMedia: 6 },
];

const mensaje400 = {
  error: "Datos no válidos",
  detalles: ["minimo debe ser un entero entre 1 y 50"],
};

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri(), { dbName: "test" });
}, 600000);

beforeEach(async () => {
  await Pelicula.deleteMany({});
  await Pelicula.insertMany(datos);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});
describe("GET /peliculas/estadisticas", () => {
  test("sin minimo devuelve todos los géneros ordenados por notaMedia desc", async () => {
    const res = await request(app).get("/peliculas/estadisticas");
    expect(res.status).toBe(200);
    expect(res.body).toEqual(esperado);
  });

  test("minimo=2 filtra géneros con menos películas", async () => {
    const res = await request(app).get("/peliculas/estadisticas?minimo=2");
    expect(res.status).toBe(200);
    expect(res.body.map((g) => g.genero)).toEqual(["Animación", "Comedia", "Drama", "Acción"]);
  });

  test("minimo=3 deja solo Drama", async () => {
    const res = await request(app).get("/peliculas/estadisticas?minimo=3");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ genero: "Drama", total: 3, notaMedia: 8 }]);
  });

  test("minimo=1 (límite inferior) equivale a no indicarlo", async () => {
    const res = await request(app).get("/peliculas/estadisticas?minimo=1");
    expect(res.status).toBe(200);
    expect(res.body).toEqual(esperado);
  });

  test("minimo=50 (límite superior) es válido y devuelve []", async () => {
    const res = await request(app).get("/peliculas/estadisticas?minimo=50");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test("colección vacía devuelve []", async () => {
    await Pelicula.deleteMany({});
    const res = await request(app).get("/peliculas/estadisticas");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test("GET /peliculas/:id con id válido sigue funcionando", async () => {
    const peli = await Pelicula.findOne({ titulo: "Coco" });
    const res = await request(app).get(`/peliculas/${peli.id}`);
    expect(res.status).toBe(200);
    expect(res.body.titulo).toBe("Coco");
  });

  test("/peliculas/estadisticas no lo captura /:id", async () => {
    const res = await request(app).get("/peliculas/estadisticas");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  describe.each(["0", "51", "abc", "1.5"])("minimo=%s", (valor) => {
    test("devuelve 400 con {error, detalles[]}", async () => {
      const res = await request(app).get(`/peliculas/estadisticas?minimo=${valor}`);
      expect(res.status).toBe(400);
      expect(res.body).toEqual(mensaje400);
    });
  });
});
