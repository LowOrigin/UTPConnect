# UTPConnect — Guía de instalación y ejecución (VERSIÓN WINDOWS)

Este proyecto actualmente contiene únicamente el **backend en Node.js**, utilizando **PostgreSQL (instalado pero aún no configurado)** y **Mosquitto (broker MQTT)**.

Cuando la app móvil en React Native esté lista, este documento se actualizará.

---

# 1. Requisitos que deben instalar (Windows)

### ✔ 1) Git

Verificar que ya este instalado:

```
git --version
```

Descargar e instalar:
[https://git-scm.com/download/win](https://git-scm.com/download/win)

---

### ✔ 2) Node.js (LTS) + npm

Usamos **solamente npm**, NO usar Yarn.

Descargar e instalar:
[https://nodejs.org/en/](https://nodejs.org/en/)

Verificar que ya este instalado:

```
node -v
npm -v
```

---

### ✔ 3) PostgreSQL

Debe instalarse, pero **aún no se configurará la base de datos**.
Descargar (incluye pgAdmin):
[https://www.postgresql.org/download/windows/](https://www.postgresql.org/download/windows/)

Verificar que ya este instalado:

```
psql --version
```

> La configuración real (crear BD, tablas, usuario, etc.) se documentará más adelante.
> Por ahora, solo asegúrate de tener PostgreSQL instalado.

---

### ✔ 4) Mosquitto (Broker MQTT)

Este SÍ está siendo utilizado actualmente.

Verificar que ya este instalado:
---------
mosquitto -h
---------

Instalar Mosquitto para Windows:

1. Descargar desde:
   [https://mosquitto.org/download/](https://mosquitto.org/download/)
2. Instalar normalmente (siguiente, siguiente)
3. Asegurarse de instalar también **mosquitto_pub** y **mosquitto_sub** (vienen incluidos)


# 2. Clonar el repositorio

```
git clone https://github.com/LowOrigin/UTPConnect.git 
cd UTPConnect
```

---

# 3. Variables de entorno (.env)

El archivo `.env` **no se sube al repositorio**, cada integrante debe crear el suyo.

En la carpeta `backend`, hacer:

```
cd backend
copy .env.example .env
```

> El `.env.example` actualmente es una plantilla **sin valores reales** porque la base de datos aún no está configurada.

Contenido del ejemplo:

```
PORT=3000

# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_USER=
DB_PASSWORD=
DB_NAME=

# MQTT
MQTT_HOST=localhost
MQTT_PORT=1883
```

Los valores reales se agregarán cuando la base de datos esté definida.

---

# 4. Instalar dependencias del backend

Dirigente en la carpeta backend y en la terminal haz lo siguiente: 

```
cd backend
npm install
```

Esto creará la carpeta `node_modules` (que **no** se sube a GitHub).

---

# 5. Ejecutar el backend

```
npm run dev
```

o

```
npm start
```

npm start ejecuta el backend una sola vez.
npm rum dev reinicia el servidor automáticamente cada vez que guardas un archivo.

---

# 6. Verificar que el backend está funcionando
*Esto no se ha verficado todavia*

Abrir en navegador:

```
http://localhost:3000
```

En la consola deberían aparecer mensajes confirmando:

* Backend iniciado
* Intento de conexión a PostgreSQL
* Conexión al broker MQTT

---

# 7. Git: vincular repositorio remoto (solo si alguien lo necesita)

```
git remote add origin https://github.com/TU_ORGANIZACION/UTPConnect.git
git branch -M main
git push -u origin main
```

---

# Estado actual del proyecto

✔ Backend Node.js funcionando
✔ Mosquitto instalado y probado
✔ PostgreSQL instalado (sin configurar aún)
✔ `.env.example` creado
✖ No existe aún la app móvil (React Native)
→ Se agregará en una actualización futura del README

---

# Fin del README
