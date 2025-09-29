#Gamifizierter Webshop Prototyp BACKEND

Die Dependencies sind über `npm install` zu installieren.
Zusätzlich wird Docker benötigt.

Vor dem ersten Start den Befehl `docker compose up -d` ausführen um den Datenbank-Container zu erzeugen.

Zum Zurücksetzen der Datenbank `docker compose down` und anschließend `docker compose up -d` verwenden.

Neben der PostgreSQL Datenbank enthält der Docker-Container Adminer, eine GUI zur Datenbankverwaltung.

>Adminer ist erreichbar über `http://localhost:8080/`

Adminer Logindaten:
>system: `postgreSQL`
server: `db`
username:`admin`
passwort: `admin`
database: `gameshop`

---
Zum Starten des Backends den Befehl `npm run start` verwenden.

Das Backend ist auf den Port 3000 konfiguriert.
