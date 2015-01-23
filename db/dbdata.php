<?php
$servername = "mysqlsvr05.world4you.com";
$username = "sql6719590";
$password = "v@nacmi";
$dbname = "6719590db4";

// Create connection
$conn = new mysqli($servername, $username, $password, $dbname);
// Check connection
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}