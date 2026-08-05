<?php

declare(strict_types=1);

$databasePath = '/tmp/baikal.sqlite';
if (file_exists($databasePath)) {
    unlink($databasePath);
}

$database = new PDO('sqlite:' . $databasePath);
$schema = file_get_contents('/var/www/baikal/Core/Resources/Db/SQLite/db.sql');
if ($schema === false) {
    throw new RuntimeException('Unable to read the Baikal SQLite schema');
}
$database->exec($schema);

$username = 'alice';
$password = 'calendar-test-password';
$realm = 'BaikalDAV';
$principal = 'principals/' . $username;

$statement = $database->prepare(
    'INSERT INTO users (username, digesta1) VALUES (:username, :digesta1)'
);
$statement->execute([
    ':username' => $username,
    ':digesta1' => md5($username . ':' . $realm . ':' . $password),
]);

$statement = $database->prepare(
    'INSERT INTO principals (uri, email, displayname) VALUES (:uri, :email, :displayname)'
);
$statement->execute([
    ':uri' => $principal,
    ':email' => 'alice@example.test',
    ':displayname' => 'Alice',
]);

$database->exec(
    "INSERT INTO calendars (id, synctoken, components) VALUES (1, 1, 'VEVENT,VTODO')"
);
$statement = $database->prepare(
    'INSERT INTO calendarinstances
        (calendarid, principaluri, access, displayname, uri, description,
         calendarorder, calendarcolor, timezone, transparent, share_invitestatus)
     VALUES
        (1, :principal, 1, :displayname, :uri, :description,
         0, :color, :timezone, 0, 2)'
);
$statement->execute([
    ':principal' => $principal,
    ':displayname' => 'Sockethub Digest',
    ':uri' => 'sockethub-digest',
    ':description' => 'Sockethub Digest integration calendar',
    ':color' => '#3a87ad',
    ':timezone' => 'Europe/Prague',
]);
