<?php

$nick = $_POST['nick'];
$score = $_POST['score'];

require_once './db/dbdata.php';

$sql = "INSERT INTO ScoreBoard (nickname, score)
VALUES ('" . $nick . "', " . $score . ")";

if ($conn->query($sql) === TRUE) {
    echo "New record created successfully";
} else {
    echo "Error: " . $sql . "<br>" . $conn->error;
}

$conn->close();
?>
