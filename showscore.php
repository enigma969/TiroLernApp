<?php

require_once './db/dbdata.php';

$sql = "SELECT nickname, score FROM ScoreBoard ORDER BY score desc";

$result = $conn->query($sql);

$return_arr = array();

$i = 1;
while ($row = mysqli_fetch_array($result)) {
    $row_array['pos'] = $i++;
    $row_array['nickname'] = $row['nickname'];
    $row_array['score'] = $row['score'];

    array_push($return_arr, $row_array);
}
$conn->close();

header("Content-type: application/json");
echo json_encode($return_arr);
