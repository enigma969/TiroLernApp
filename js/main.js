//test

$(document).ready(function () {
    var map;
    var adressen;
    var gebirge;
    var correctMarker;
    var markers = [];
    var lifes = 5;
    var score = 0;
    var correctName = "";

    function initialize() {
        var mapOptions = {
            center: new google.maps.LatLng(47.252978, 11.398447),
            zoom: 9,
            disableDefaultUI: true,
            mapTypeId: google.maps.MapTypeId.MAP,
            draggable: false,
            disableDoubleClickZoom: true,
            zoomControl: false,
            scrollwheel: false,
            styles: [
                {
                    "elementType": "labels",
                    "stylers": [
                        {"visibility": "off"}
                    ]
                }
            ]
        };
        map = new google.maps.Map(document.getElementById('map_canvas'), mapOptions);
    }

    $.getJSON("js/gemeinden.json", function (data) {
        adressen = data.root;
    });

    $.getJSON("js/gebirge.json", function (data) {
        gebirge = data.berge;
    });

    function addMarker(e, isCorrect) {
        var marker = new google.maps.Marker({
            position: new google.maps.LatLng(e.y, e.x),
            map: map
        });
        google.maps.event.addListener(marker, 'click', function () {

            disableAllMarkers();
            if (this === correctMarker) {
                correctSelection(this);
            } else {
                wrongSelection();
            }
        });
        markers.push(marker);
        if (isCorrect) {
            correctMarker = marker;
        }
    }

    function correctSelection(marker) {
        score++;
        $('.score').text(score);
        markCorrectMarker(marker);
        waitNewQuestion();
    }

    function wrongSelection() {
        for (var i = 0; i < markers.length; i++) {
            if (markers[i] === correctMarker) {
                markCorrectMarker(markers[i]);
            }
        }
        $('#headerRight img:first').remove();
        lifes--;
        if (lifes < 1) {
            gameOver();
        } else {
            waitNewQuestion();
        }
    }

    function gameOver() {
        $("#dialog-gameover").dialog({
            resizable: false,
            height: 220,
            modal: true,
            buttons: {
                "In Rangliste eintragen": function () {
                    saveScore();
                    $(this).dialog("close");
                }
            }
        });
    }

    function saveScore() {
        $.ajax({
            type: "POST",
            url: "regscore.php",
            data: {nick: $('#nickname').val(), score: score},
            success: function (data) {
                showScores();
            }
        });
    }

    function showScores() {
        $("#scoreboardTable tbody tr").each(function () {
            this.parentNode.removeChild(this);
        });
        $.ajax({
            type: "GET",
            url: "showscore.php",
            success: function (data) {
                for (var i = 0; i < data.length; i++) {
                    console.log('insert');
                    $('#scoreboardTable tbody').append('<tr><td>' + data[i].pos + '</td><td>' + data[i].nickname + '</td><td>' + data[i].score + '</td></tr>');
                }
                $("#dialog-scoreboard").dialog({
                    resizable: false,
                    height: 300,
                    modal: true,
                    buttons: {
                        "Neues Spiel": function () {
                            $(this).dialog("close");
                            newGame();
                        }
                    }
                });
            },
            error: function () {
            }
        });
    }

    $('#showHighscores').click(function () {
        showScores();
    });

    function disableAllMarkers() {
        for (var i = 0; i < markers.length; i++) {
            google.maps.event.clearInstanceListeners(markers[i]);
        }
    }

    function waitNewQuestion() {
        if ($('#lernmode:checked')) {
//            $('body').one('click', function() {
//                newQuestion();
//            }); 
        } else {
            setTimeout(function () {
                newQuestion();
            }, 5000);
        }
    }


    function markCorrectMarker(marker) {
        marker.setIcon("./img/green-marker.png");

        var contentString = '<div id="article">' + wikicontent + '</div>';
        var infowindow = new google.maps.InfoWindow({
            content: contentString
        });

        infowindow.open(map, marker);
    }

    function clearMarkers() {
        for (var i = 0; i < markers.length; i++) {
            markers[i].setMap(null);
        }
    }

    function deleteMarkers() {
        clearMarkers();
        markers = [];
    }

    function newQuestion() {
        deleteMarkers();
        try {
            var correct = Math.floor((Math.random() * adressen.length) + 1);
            getLatLng(adressen[correct].geometry.x, adressen[correct].geometry.y, true, addMarker);
            var uncorrect1;
            do {
                uncorrect1 = Math.floor((Math.random() * adressen.length) + 1);
            } while (uncorrect1 === correct);
            getLatLng(adressen[uncorrect1].geometry.x, adressen[uncorrect1].geometry.y, false, addMarker);
            var uncorrect2;
            do {
                uncorrect2 = Math.floor((Math.random() * adressen.length) + 1);
            } while (uncorrect2 === correct || uncorrect2 === uncorrect1);
            getLatLng(adressen[uncorrect2].geometry.x, adressen[uncorrect2].geometry.y, false, addMarker);
            $('#question').text('Wo befindet sich ' + adressen[correct].attributes.GEMNAME + "?");

            correctName = adressen[correct].attributes.GEMNAME;

            $.ajax({
                type: "GET",
                url: "http://de.wikipedia.org/w/api.php?action=parse&format=json&prop=text&section=0&page=" + correctName + "&callback=?",
                contentType: "application/json; charset=utf-8",
                async: false,
                dataType: "json",
                success: function (data, textStatus, jqXHR) {

                    var markup = data.parse.text["*"];
                    var i = $('<div></div>').html(markup);

                    // Links entfernen
                    i.find('a').each(function () {
                        $(this).replaceWith($(this).html());
                    });

                    // References entfernen
                    i.find('sup').remove();

                    // Cite error entfernen
                    i.find('.mw-ext-cite-error').remove();

                    //findet den ersten p Paragraph
                    i = i.find('p');

                    wikicontent = $(i).prop('outerHTML');
                },
                error: function (errorMessage) {
                }
            });
        } catch (e) {
            newQuestion();
        }
    }

    function getLatLng(_x, _y, isCorrect, callback) {
        require(["esri/tasks/GeometryService", "esri/tasks/ProjectParameters", "esri/geometry/Point", "esri/SpatialReference"], function (GeometryService, ProjectParameters, Point, SpatialReference) {
            var geometryService = new GeometryService("http://tasks.arcgisonline.com/ArcGIS/rest/services/Geometry/GeometryServer");
            var params = new ProjectParameters();
            params.geometries = [new Point({
                    x: _x,
                    y: _y,
                    spatialReference: {
                        wkid: 31254
                    }
                })];
            params.outSR = new SpatialReference({
                wkid: 4326
            });
            geometryService.project(params).then(function (e) {
                callback(e[0], isCorrect);
            });
        });
    }

    function addLifes() {
        for (var i = 0; i < 5; i++) {
            $('#headerRight').prepend('<img class="life" src="./img/life.png" alt="life">');
        }
    }

    $('#start').click(function () {
        $('#start').hide();
        newGame();
    });

    function newGame() {
        $("#headerRight img").each(function () {
            this.parentNode.removeChild(this);
        });
        deleteMarkers();
        addLifes();
        lifes = 5;
        score = 0;
        $('.score').text(score);
        newQuestion();
    }

    $(function () {
        $("#dialog-start").dialog({
            resizable: false,
            height: 150,
            modal: true,
            buttons: {
                "Start": function () {
                    $(this).dialog("close");
                    newGame();
                }
            }
        });
    });

    initialize();


});