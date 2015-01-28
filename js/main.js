

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
            draggable: false,
            disableDoubleClickZoom: true,
            zoomControl: false,
            scrollwheel: false,
            styles: [
            {
                elementType: "labels",
                stylers: [
                    {"visibility": "off"}
                ] 
            } 
            ]
        };
        
        map = new google.maps.Map(document.getElementById('map_canvas'), mapOptions);

        addPolyline();
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
//        if ($('#lernmode:checked')) {
//            $('body').one('click', function() {
//                newQuestion();
//            }); 
//       } else {
            setTimeout(function () {
                newQuestion();
            }, 5000);
//       }
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
    function addPolyline() {
    
        var myCoordinates = [
            new google.maps.LatLng(47.270843,10.178146),
            new google.maps.LatLng(47.263854,10.174026),
            new google.maps.LatLng(47.261990,10.189819),
            new google.maps.LatLng(47.258262,10.198059),
            new google.maps.LatLng(47.257330,10.206299),
            new google.maps.LatLng(47.255466,10.217285),
            new google.maps.LatLng(47.251737,10.223465),
            new google.maps.LatLng(47.248475,10.219345),
            new google.maps.LatLng(47.248475,10.211792),
            new google.maps.LatLng(47.238219,10.198059),
            new google.maps.LatLng(47.232625,10.201492),
            new google.maps.LatLng(47.233091,10.206985),
            new google.maps.LatLng(47.227496,10.211105),
            new google.maps.LatLng(47.226097,10.209732),
            new google.maps.LatLng(47.223765,10.212479),
            new google.maps.LatLng(47.219568,10.211792),
            new google.maps.LatLng(47.216770,10.213852),
            new google.maps.LatLng(47.206975,10.213165),
            new google.maps.LatLng(47.202310,10.209732),
            new google.maps.LatLng(47.196245,10.201492),
            new google.maps.LatLng(47.195312,10.196686),
            new google.maps.LatLng(47.188313,10.198746),
            new google.maps.LatLng(47.182246,10.200119),
            new google.maps.LatLng(47.178979,10.203552),
            new google.maps.LatLng(47.175245,10.204239),
            new google.maps.LatLng(47.171044,10.211105),
            new google.maps.LatLng(47.169177,10.209045),
            new google.maps.LatLng(47.164976,10.209045),
            new google.maps.LatLng(47.164042,10.207672),
            new google.maps.LatLng(47.158906,10.207672),
            new google.maps.LatLng(47.155638,10.215225),
            new google.maps.LatLng(47.152369,10.222092),
            new google.maps.LatLng(47.146299,10.217972),
            new google.maps.LatLng(47.143496,10.214539),
            new google.maps.LatLng(47.143963,10.210419),
            new google.maps.LatLng(47.142562,10.203552),
            new google.maps.LatLng(47.137425,10.202866),
            new google.maps.LatLng(47.133221,10.209732),
            new google.maps.LatLng(47.130885,10.208359),
            new google.maps.LatLng(47.131352,10.198059),
            new google.maps.LatLng(47.128082,10.185699),
            new google.maps.LatLng(47.119205,10.187073),
            new google.maps.LatLng(47.119205,10.183640),
            new google.maps.LatLng(47.120140,10.182266),
            new google.maps.LatLng(47.119672,10.171967),
            new google.maps.LatLng(47.114533,10.164413),
            new google.maps.LatLng(47.114533,10.158920),
            new google.maps.LatLng(47.102849,10.151367),
            new google.maps.LatLng(47.097240,10.145187),
            new google.maps.LatLng(47.090696,10.140381),
            new google.maps.LatLng(47.087891,10.140381),
            new google.maps.LatLng(47.084150,10.134201),
            new google.maps.LatLng(47.080410,10.132141),
            new google.maps.LatLng(47.068719,10.135574),
            new google.maps.LatLng(47.064509,10.134888),
            new google.maps.LatLng(47.063574,10.140381),
            new google.maps.LatLng(47.060767,10.147934),
            new google.maps.LatLng(47.061703,10.150681),
            new google.maps.LatLng(47.049540,10.156174),
            new google.maps.LatLng(47.043458,10.154114),
            new google.maps.LatLng(47.037374,10.146561),
            new google.maps.LatLng(47.033631,10.143814),
            new google.maps.LatLng(47.027546,10.130081),
            new google.maps.LatLng(47.023802,10.123901),
            new google.maps.LatLng(47.020057,10.126648),
            new google.maps.LatLng(47.014439,10.130081),
            new google.maps.LatLng(47.010226,10.138321),
            new google.maps.LatLng(47.005543,10.155487),
            new google.maps.LatLng(46.998988,10.158920),
            new google.maps.LatLng(46.996646,10.156860),
            new google.maps.LatLng(46.991494,10.154800),
            new google.maps.LatLng(46.984468,10.160294),
            new google.maps.LatLng(46.982595,10.152054),
            new google.maps.LatLng(46.982595,10.145187),
            new google.maps.LatLng(46.975568,10.141068),
            new google.maps.LatLng(46.966197,10.134888),
            new google.maps.LatLng(46.961511,10.136948),
            new google.maps.LatLng(46.953543,10.134201),
            new google.maps.LatLng(46.946512,10.128021),
            new google.maps.LatLng(46.938543,10.120468),
            new google.maps.LatLng(46.937605,10.112228),
            new google.maps.LatLng(46.933385,10.108109),
            new google.maps.LatLng(46.930572,10.106735),
            new google.maps.LatLng(46.927290,10.097122),
            new google.maps.LatLng(46.918848,10.097809),
            new google.maps.LatLng(46.908529,10.110168),
            new google.maps.LatLng(46.906184,10.107422),
            new google.maps.LatLng(46.902431,10.109482),
            new google.maps.LatLng(46.895862,10.108795),
            new google.maps.LatLng(46.890232,10.113602),
            new google.maps.LatLng(46.879907,10.125961),
            new google.maps.LatLng(46.876622,10.134888),
            new google.maps.LatLng(46.874744,10.141068),
            new google.maps.LatLng(46.870519,10.142441),
            new google.maps.LatLng(46.869111,10.140381),
            new google.maps.LatLng(46.863947,10.141068),
            new google.maps.LatLng(46.860661,10.141068),
            new google.maps.LatLng(46.858782,10.143127),
            new google.maps.LatLng(46.851269,10.143814),
            new google.maps.LatLng(46.849861,10.154114),
            new google.maps.LatLng(46.848452,10.156174),
            new google.maps.LatLng(46.850800,10.162354),
            new google.maps.LatLng(46.850800,10.170593),
            new google.maps.LatLng(46.853148,10.170593),
            new google.maps.LatLng(46.853265,10.177116),
            new google.maps.LatLng(46.855026,10.181923),
            new google.maps.LatLng(46.859721,10.184498),
            new google.maps.LatLng(46.862069,10.190334),
            new google.maps.LatLng(46.866294,10.193939),
            new google.maps.LatLng(46.867233,10.199432),
            new google.maps.LatLng(46.865355,10.204239),
            new google.maps.LatLng(46.865708,10.214882),
            new google.maps.LatLng(46.867468,10.219860),
            new google.maps.LatLng(46.866060,10.225439),
            new google.maps.LatLng(46.866177,10.232220),
            new google.maps.LatLng(46.870519,10.231018),
            new google.maps.LatLng(46.885539,10.233765),
            new google.maps.LatLng(46.889293,10.229645),
            new google.maps.LatLng(46.896801,10.226898),
            new google.maps.LatLng(46.902431,10.233765),
            new google.maps.LatLng(46.915565,10.237885),
            new google.maps.LatLng(46.920255,10.240631),
            new google.maps.LatLng(46.930572,10.240631),
            new google.maps.LatLng(46.930572,10.263977),
            new google.maps.LatLng(46.924007,10.290070),
            new google.maps.LatLng(46.919317,10.296936),
            new google.maps.LatLng(46.924007,10.299683),
            new google.maps.LatLng(46.924945,10.314789),
            new google.maps.LatLng(46.930572,10.314789),
            new google.maps.LatLng(46.939012,10.306549),
            new google.maps.LatLng(46.951200,10.309296),
            new google.maps.LatLng(46.953075,10.327148),
            new google.maps.LatLng(46.968071,10.331268),
            new google.maps.LatLng(46.977441,10.340881),
            new google.maps.LatLng(46.980252,10.340881),
            new google.maps.LatLng(46.982126,10.345001),
            new google.maps.LatLng(46.987747,10.343628),
            new google.maps.LatLng(46.992431,10.354614),
            new google.maps.LatLng(46.992431,10.371094),
            new google.maps.LatLng(46.998051,10.383453),
            new google.maps.LatLng(46.999924,10.388947),
            new google.maps.LatLng(46.996178,10.398560),
            new google.maps.LatLng(46.992431,10.401306),
            new google.maps.LatLng(46.988684,10.408173),
            new google.maps.LatLng(46.981189,10.412292),
            new google.maps.LatLng(46.981189,10.419159),
            new google.maps.LatLng(46.975568,10.426025),
            new google.maps.LatLng(46.970882,10.427399),
            new google.maps.LatLng(46.966197,10.423279),
            new google.maps.LatLng(46.959636,10.424652),
            new google.maps.LatLng(46.954949,10.428772),
            new google.maps.LatLng(46.954949,10.439758),
            new google.maps.LatLng(46.953075,10.454865),
            new google.maps.LatLng(46.946512,10.468597),
            new google.maps.LatLng(46.940887,10.475464),
            new google.maps.LatLng(46.937136,10.489197),
            new google.maps.LatLng(46.931510,10.486450),
            new google.maps.LatLng(46.918379,10.485077),
            new google.maps.LatLng(46.908998,10.476837),
            new google.maps.LatLng(46.893047,10.475464),
            new google.maps.LatLng(46.885539,10.464478),
            new google.maps.LatLng(46.881784,10.468597),
            new google.maps.LatLng(46.863008,10.467224),
            new google.maps.LatLng(46.854557,10.469971),
            new google.maps.LatLng(46.857374,10.479584),
            new google.maps.LatLng(46.854557,10.489197),
            new google.maps.LatLng(46.850800,10.489197),
            new google.maps.LatLng(46.851739,10.493317),
            new google.maps.LatLng(46.847982,10.497437),
            new google.maps.LatLng(46.847982,10.512543),
            new google.maps.LatLng(46.845164,10.520782),
            new google.maps.LatLng(46.850800,10.552368),
            new google.maps.LatLng(46.849861,10.556488),
            new google.maps.LatLng(46.838589,10.545502),
            new google.maps.LatLng(46.841407,10.568848),
            new google.maps.LatLng(46.846104,10.574341),
            new google.maps.LatLng(46.850800,10.589447),
            new google.maps.LatLng(46.857374,10.596313),
            new google.maps.LatLng(46.858313,10.610046),
            new google.maps.LatLng(46.864886,10.625153),
            new google.maps.LatLng(46.865825,10.651245),
            new google.maps.LatLng(46.875213,10.666351),
            new google.maps.LatLng(46.870519,10.671844),
            new google.maps.LatLng(46.870519,10.678711),
            new google.maps.LatLng(46.868642,10.689697),
            new google.maps.LatLng(46.862069,10.696564),
            new google.maps.LatLng(46.859252,10.692444),
            new google.maps.LatLng(46.852678,10.692444),
            new google.maps.LatLng(46.851739,10.699310),
            new google.maps.LatLng(46.846104,10.706863),
            new google.maps.LatLng(46.847043,10.717163),
            new google.maps.LatLng(46.843286,10.715790),
            new google.maps.LatLng(46.839528,10.719910),
            new google.maps.LatLng(46.838589,10.732269),
            new google.maps.LatLng(46.834831,10.736389),
            new google.maps.LatLng(46.833892,10.754242),
            new google.maps.LatLng(46.829194,10.758362),
            new google.maps.LatLng(46.824496,10.765228),
            new google.maps.LatLng(46.818388,10.760765),
            new google.maps.LatLng(46.814159,10.750122),
            new google.maps.LatLng(46.802880,10.744629),
            new google.maps.LatLng(46.799354,10.737762),
            new google.maps.LatLng(46.797944,10.726089),
            new google.maps.LatLng(46.790658,10.728149),
            new google.maps.LatLng(46.786897,10.730896),
            new google.maps.LatLng(46.787837,10.748749),
            new google.maps.LatLng(46.785016,10.755615),
            new google.maps.LatLng(46.787367,10.766602),
            new google.maps.LatLng(46.791128,10.779648),
            new google.maps.LatLng(46.796299,10.783081),
            new google.maps.LatLng(46.789718,10.792694),
            new google.maps.LatLng(46.792538,10.795441),
            new google.maps.LatLng(46.774671,10.813293),
            new google.maps.LatLng(46.774671,10.824280),
            new google.maps.LatLng(46.782195,10.833893),
            new google.maps.LatLng(46.782195,10.839386),
            new google.maps.LatLng(46.780314,10.843506),
            new google.maps.LatLng(46.773731,10.851402),
            new google.maps.LatLng(46.771850,10.867195),
            new google.maps.LatLng(46.766206,10.870972),
            new google.maps.LatLng(46.762443,10.883331),
            new google.maps.LatLng(46.769028,10.895691),
            new google.maps.LatLng(46.769028,10.906677),
            new google.maps.LatLng(46.772790,10.914917),
            new google.maps.LatLng(46.775612,10.923157),
            new google.maps.LatLng(46.773731,10.928650),
            new google.maps.LatLng(46.775142,10.945816),
            new google.maps.LatLng(46.772320,10.975342),
            new google.maps.LatLng(46.768087,10.979462),
            new google.maps.LatLng(46.768087,10.993195),
            new google.maps.LatLng(46.768557,11.004181),
            new google.maps.LatLng(46.771379,11.014481),
            new google.maps.LatLng(46.765265,11.020660),
            new google.maps.LatLng(46.766206,11.023407),
            new google.maps.LatLng(46.772790,11.026154),
            new google.maps.LatLng(46.786897,11.034393),
            new google.maps.LatLng(46.792538,11.033020),
            new google.maps.LatLng(46.801000,11.044006),
            new google.maps.LatLng(46.804760,11.041260),
            new google.maps.LatLng(46.808520,11.050873),
            new google.maps.LatLng(46.809459,11.056366),
            new google.maps.LatLng(46.812279,11.060486),
            new google.maps.LatLng(46.820737,11.074219),
            new google.maps.LatLng(46.821677,11.082458),
            new google.maps.LatLng(46.836710,11.076965),
            new google.maps.LatLng(46.839528,11.070099),
            new google.maps.LatLng(46.844225,11.074219),
            new google.maps.LatLng(46.855496,11.072845),
            new google.maps.LatLng(46.860191,11.078339),
            new google.maps.LatLng(46.875213,11.085205),
            new google.maps.LatLng(46.889293,11.101685),
            new google.maps.LatLng(46.893047,11.097565),
            new google.maps.LatLng(46.902431,11.097565),
            new google.maps.LatLng(46.909937,11.093445),
            new google.maps.LatLng(46.914627,11.096191),
            new google.maps.LatLng(46.917441,11.107178),
            new google.maps.LatLng(46.921193,11.111298),
            new google.maps.LatLng(46.927759,11.108551),
            new google.maps.LatLng(46.932448,11.115417),
            new google.maps.LatLng(46.929634,11.126404),
            new google.maps.LatLng(46.927759,11.138763),
            new google.maps.LatLng(46.932448,11.147003),
            new google.maps.LatLng(46.941824,11.167603),
            new google.maps.LatLng(46.950262,11.162109),
            new google.maps.LatLng(46.953075,11.166229),
            new google.maps.LatLng(46.964322,11.166229),
            new google.maps.LatLng(46.962448,11.175156),
            new google.maps.LatLng(46.967134,11.185455),
            new google.maps.LatLng(46.971351,11.188889),
            new google.maps.LatLng(46.968071,11.191635),
            new google.maps.LatLng(46.969477,11.195068),
            new google.maps.LatLng(46.968539,11.202621),
            new google.maps.LatLng(46.963385,11.205368),
            new google.maps.LatLng(46.968539,11.219788),
            new google.maps.LatLng(46.969945,11.225967),
            new google.maps.LatLng(46.969477,11.235580),
            new google.maps.LatLng(46.969945,11.241074),
            new google.maps.LatLng(46.972288,11.245193),
            new google.maps.LatLng(46.974162,11.249313),
            new google.maps.LatLng(46.974630,11.255493),
            new google.maps.LatLng(46.978847,11.258926),
            new google.maps.LatLng(46.981658,11.263046),
            new google.maps.LatLng(46.980252,11.270599),
            new google.maps.LatLng(46.983063,11.285019),
            new google.maps.LatLng(46.985874,11.289139),
            new google.maps.LatLng(46.986342,11.293945),
            new google.maps.LatLng(46.984468,11.298752),
            new google.maps.LatLng(46.984468,11.307678),
            new google.maps.LatLng(46.989621,11.312485),
            new google.maps.LatLng(46.992899,11.320724),
            new google.maps.LatLng(46.989152,11.328278),
            new google.maps.LatLng(46.989152,11.334457),
            new google.maps.LatLng(46.985405,11.335831),
            new google.maps.LatLng(46.985405,11.339951),
            new google.maps.LatLng(46.991494,11.346130),
            new google.maps.LatLng(46.991494,11.358490),
            new google.maps.LatLng(46.984000,11.365356),
            new google.maps.LatLng(46.979315,11.374969),
            new google.maps.LatLng(46.970882,11.384583),
            new google.maps.LatLng(46.969945,11.392822),
            new google.maps.LatLng(46.965259,11.399689),
            new google.maps.LatLng(46.964322,11.405182),
            new google.maps.LatLng(46.967602,11.409988),
            new google.maps.LatLng(46.967602,11.418915),
            new google.maps.LatLng(46.974630,11.434021),
            new google.maps.LatLng(46.976036,11.442261),
            new google.maps.LatLng(46.983532,11.445007),
            new google.maps.LatLng(46.993368,11.453934),
            new google.maps.LatLng(46.991494,11.460800),
            new google.maps.LatLng(46.995709,11.468353),
            new google.maps.LatLng(46.999456,11.468353),
            new google.maps.LatLng(47.004607,11.471100),
            new google.maps.LatLng(47.004607,11.473160),
            new google.maps.LatLng(47.011630,11.478653),
            new google.maps.LatLng(47.010226,11.495132),
            new google.maps.LatLng(47.008821,11.501312),
            new google.maps.LatLng(47.005075,11.510925),
            new google.maps.LatLng(47.002266,11.515732),
            new google.maps.LatLng(47.000393,11.515045),
            new google.maps.LatLng(46.997114,11.521225),
            new google.maps.LatLng(46.991963,11.531525),
            new google.maps.LatLng(46.987747,11.534271),
            new google.maps.LatLng(46.984468,11.537704),
            new google.maps.LatLng(46.984468,11.541138),
            new google.maps.LatLng(46.985874,11.542511),
            new google.maps.LatLng(46.991494,11.554184),
            new google.maps.LatLng(46.989621,11.559677),
            new google.maps.LatLng(46.992899,11.563797),
            new google.maps.LatLng(46.992899,11.569977),
            new google.maps.LatLng(46.999456,11.581650),
            new google.maps.LatLng(47.003202,11.581650),
            new google.maps.LatLng(47.006012,11.590576),
            new google.maps.LatLng(47.006012,11.600189),
            new google.maps.LatLng(47.008821,11.607056),
            new google.maps.LatLng(47.013971,11.616669),
            new google.maps.LatLng(47.012098,11.620102),
            new google.maps.LatLng(47.013503,11.625595),
            new google.maps.LatLng(47.008353,11.629715),
            new google.maps.LatLng(47.006948,11.633148),
            new google.maps.LatLng(47.004139,11.635895),
            new google.maps.LatLng(47.001797,11.639328),
            new google.maps.LatLng(47.001797,11.642761),
            new google.maps.LatLng(46.994304,11.660614),
            new google.maps.LatLng(46.992899,11.664047),
            new google.maps.LatLng(46.992899,11.668167),
            new google.maps.LatLng(46.993836,11.673660),
            new google.maps.LatLng(46.993368,11.676407),
            new google.maps.LatLng(46.995709,11.689453),
            new google.maps.LatLng(46.993836,11.697693),
            new google.maps.LatLng(46.993368,11.712112),
            new google.maps.LatLng(46.986810,11.717606),
            new google.maps.LatLng(46.983532,11.718292),
            new google.maps.LatLng(46.979315,11.725159),
            new google.maps.LatLng(46.976973,11.725159),
            new google.maps.LatLng(46.971819,11.733398),
            new google.maps.LatLng(46.970882,11.737518),
            new google.maps.LatLng(46.969008,11.748505),
            new google.maps.LatLng(46.970882,11.751938),
            new google.maps.LatLng(46.972288,11.759491),
            new google.maps.LatLng(46.972756,11.764984),
            new google.maps.LatLng(46.978847,11.767044),
            new google.maps.LatLng(46.985874,11.773224),
            new google.maps.LatLng(46.989152,11.780090),
            new google.maps.LatLng(46.991963,11.782150),
            new google.maps.LatLng(46.990558,11.789703),
            new google.maps.LatLng(46.991963,11.803436),
            new google.maps.LatLng(46.989621,11.815109),
            new google.maps.LatLng(46.993836,11.828842),
            new google.maps.LatLng(46.992431,11.831589),
            new google.maps.LatLng(46.992899,11.836395),
            new google.maps.LatLng(46.998519,11.840515),
            new google.maps.LatLng(47.001797,11.846008),
            new google.maps.LatLng(47.001329,11.852875),
            new google.maps.LatLng(47.008353,11.859741),
            new google.maps.LatLng(47.010226,11.865921),
            new google.maps.LatLng(47.011630,11.869354),
            new google.maps.LatLng(47.010226,11.874161),
            new google.maps.LatLng(47.013971,11.877594),
            new google.maps.LatLng(47.016780,11.880341),
            new google.maps.LatLng(47.017248,11.892700),
            new google.maps.LatLng(47.021461,11.895447),
            new google.maps.LatLng(47.028482,11.909866),
            new google.maps.LatLng(47.029418,11.914673),
            new google.maps.LatLng(47.033163,11.915359),
            new google.maps.LatLng(47.035503,11.928406),
            new google.maps.LatLng(47.037842,11.932526),
            new google.maps.LatLng(47.036906,11.942139),
            new google.maps.LatLng(47.033631,11.946259),
            new google.maps.LatLng(47.034567,11.949005),
            new google.maps.LatLng(47.037842,11.950378),
            new google.maps.LatLng(47.041118,11.953812),
            new google.maps.LatLng(47.042990,11.957245),
            new google.maps.LatLng(47.041586,11.962051),
            new google.maps.LatLng(47.041118,11.967545),
            new google.maps.LatLng(47.047669,11.975098),
            new google.maps.LatLng(47.050008,11.979904),
            new google.maps.LatLng(47.047669,11.986771),
            new google.maps.LatLng(47.049540,11.994324),
            new google.maps.LatLng(47.049540,12.000504),
            new google.maps.LatLng(47.047201,12.019730),
            new google.maps.LatLng(47.050944,12.029343),
            new google.maps.LatLng(47.057025,12.033463),
            new google.maps.LatLng(47.062171,12.044449),
            new google.maps.LatLng(47.060767,12.047882),
            new google.maps.LatLng(47.061703,12.050629),
            new google.maps.LatLng(47.061235,12.056122),
            new google.maps.LatLng(47.057961,12.059555),
            new google.maps.LatLng(47.059364,12.076035),
            new google.maps.LatLng(47.067316,12.079468),
            new google.maps.LatLng(47.070589,12.084274),
            new google.maps.LatLng(47.075266,12.093201),
            new google.maps.LatLng(47.076669,12.092514),
            new google.maps.LatLng(47.078539,12.103500),
            new google.maps.LatLng(47.072928,12.117920),
            new google.maps.LatLng(47.077604,12.129593),
            new google.maps.LatLng(47.077604,12.133026),
            new google.maps.LatLng(47.080877,12.136459),
            new google.maps.LatLng(47.079475,12.146072),
            new google.maps.LatLng(47.079942,12.151566),
            new google.maps.LatLng(47.082280,12.156372),
            new google.maps.LatLng(47.082280,12.163925),
            new google.maps.LatLng(47.087423,12.170792),
            new google.maps.LatLng(47.088358,12.177658),
            new google.maps.LatLng(47.090696,12.180319),
            new google.maps.LatLng(47.090696,12.180405),
            new google.maps.LatLng(47.091631,12.186584),
            new google.maps.LatLng(47.089293,12.198257),
            new google.maps.LatLng(47.087423,12.204437),
            new google.maps.LatLng(47.086488,12.214050),
            new google.maps.LatLng(47.083683,12.218170),
            new google.maps.LatLng(47.081929,12.226925),
            new google.maps.LatLng(47.074798,12.232590),
            new google.maps.LatLng(47.069654,12.240829),
            new google.maps.LatLng(47.066848,12.237396),
            new google.maps.LatLng(47.064042,12.229843),
            new google.maps.LatLng(47.060300,12.225723),
            new google.maps.LatLng(47.059364,12.217484),
            new google.maps.LatLng(47.047201,12.217484),
            new google.maps.LatLng(47.042522,12.211990),
            new google.maps.LatLng(47.036439,12.211990),
            new google.maps.LatLng(47.028482,12.204437),
            new google.maps.LatLng(47.027078,12.203751),
            new google.maps.LatLng(47.024738,12.182465),
            new google.maps.LatLng(47.025674,12.179031),
            new google.maps.LatLng(47.023802,12.176285),
            new google.maps.LatLng(47.023802,12.172165),
            new google.maps.LatLng(47.019589,12.164612),
            new google.maps.LatLng(47.021929,12.158432),
            new google.maps.LatLng(47.024738,12.148132),
            new google.maps.LatLng(47.022866,12.141953),
            new google.maps.LatLng(47.019589,12.139893),
            new google.maps.LatLng(47.015844,12.130280),
            new google.maps.LatLng(47.010226,12.122040),
            new google.maps.LatLng(47.006480,12.120667),
            new google.maps.LatLng(47.001797,12.125473),
            new google.maps.LatLng(46.997583,12.126846),
            new google.maps.LatLng(46.992899,12.129593),
            new google.maps.LatLng(46.992431,12.128220),
            new google.maps.LatLng(46.989621,12.129593),
            new google.maps.LatLng(46.986342,12.127533),
            new google.maps.LatLng(46.982595,12.137833),
            new google.maps.LatLng(46.975099,12.135773),
            new google.maps.LatLng(46.965259,12.136459),
            new google.maps.LatLng(46.963854,12.130966),
            new google.maps.LatLng(46.957761,12.137833),
            new google.maps.LatLng(46.953543,12.147446),
            new google.maps.LatLng(46.949794,12.158432),
            new google.maps.LatLng(46.937605,12.169418),
            new google.maps.LatLng(46.933854,12.166672),
            new google.maps.LatLng(46.928228,12.159119),
            new google.maps.LatLng(46.915096,12.152252),
            new google.maps.LatLng(46.914627,12.144699),
            new google.maps.LatLng(46.909467,12.158432),
            new google.maps.LatLng(46.907122,12.161865),
            new google.maps.LatLng(46.910406,12.170105),
            new google.maps.LatLng(46.908060,12.178345),
            new google.maps.LatLng(46.908060,12.181778),
            new google.maps.LatLng(46.906653,12.190704),
            new google.maps.LatLng(46.902431,12.191391),
            new google.maps.LatLng(46.903369,12.194138),
            new google.maps.LatLng(46.901492,12.194824),
            new google.maps.LatLng(46.897270,12.199631),
            new google.maps.LatLng(46.893047,12.196198),
            new google.maps.LatLng(46.889762,12.201004),
            new google.maps.LatLng(46.887416,12.200317),
            new google.maps.LatLng(46.886477,12.203751),
            new google.maps.LatLng(46.882254,12.207870),
            new google.maps.LatLng(46.876152,12.214737),
            new google.maps.LatLng(46.873805,12.216797),
            new google.maps.LatLng(46.880376,12.221603),
            new google.maps.LatLng(46.879438,12.225723),
            new google.maps.LatLng(46.881315,12.232590),
            new google.maps.LatLng(46.889293,12.236023),
            new google.maps.LatLng(46.891639,12.242889),
            new google.maps.LatLng(46.889293,12.247009),
            new google.maps.LatLng(46.886947,12.260742),
            new google.maps.LatLng(46.886947,12.265549),
            new google.maps.LatLng(46.883662,12.273788),
            new google.maps.LatLng(46.880376,12.277908),
            new google.maps.LatLng(46.875683,12.274475),
            new google.maps.LatLng(46.871928,12.279282),
            new google.maps.LatLng(46.869111,12.282028),
            new google.maps.LatLng(46.866294,12.288895),
            new google.maps.LatLng(46.863478,12.290268),
            new google.maps.LatLng(46.856904,12.290268),
            new google.maps.LatLng(46.851269,12.291641),
            new google.maps.LatLng(46.848452,12.295761),
            new google.maps.LatLng(46.846104,12.295761),
            new google.maps.LatLng(46.843755,12.296448),
            new google.maps.LatLng(46.843755,12.302628),
            new google.maps.LatLng(46.841877,12.307434),
            new google.maps.LatLng(46.837180,12.304688),
            new google.maps.LatLng(46.833892,12.305374),
            new google.maps.LatLng(46.822617,12.288208),
            new google.maps.LatLng(46.816038,12.283401),
            new google.maps.LatLng(46.808989,12.289581),
            new google.maps.LatLng(46.805700,12.288895),
            new google.maps.LatLng(46.802410,12.290955),
            new google.maps.LatLng(46.801470,12.287521),
            new google.maps.LatLng(46.794419,12.287521),
            new google.maps.LatLng(46.792538,12.280655),
            new google.maps.LatLng(46.783135,12.284088),
            new google.maps.LatLng(46.784546,12.297821),
            new google.maps.LatLng(46.783135,12.302628),
            new google.maps.LatLng(46.784546,12.308121),
            new google.maps.LatLng(46.781725,12.324600),
            new google.maps.LatLng(46.779374,12.331467),
            new google.maps.LatLng(46.779844,12.337646),
            new google.maps.LatLng(46.776552,12.342453),
            new google.maps.LatLng(46.776552,12.352066),
            new google.maps.LatLng(46.775142,12.354813),
            new google.maps.LatLng(46.774671,12.357559),
            new google.maps.LatLng(46.770439,12.358932),
            new google.maps.LatLng(46.754446,12.365799),
            new google.maps.LatLng(46.742213,12.368546),
            new google.maps.LatLng(46.739861,12.371292),
            new google.maps.LatLng(46.733272,12.374039),
            new google.maps.LatLng(46.726683,12.378159),
            new google.maps.LatLng(46.722918,12.376785),
            new google.maps.LatLng(46.716327,12.382965),
            new google.maps.LatLng(46.716327,12.387085),
            new google.maps.LatLng(46.708794,12.401505),
            new google.maps.LatLng(46.705027,12.404251),
            new google.maps.LatLng(46.705969,12.409058),
            new google.maps.LatLng(46.700319,12.414551),
            new google.maps.LatLng(46.699377,12.426224),
            new google.maps.LatLng(46.696080,12.428284),
            new google.maps.LatLng(46.695138,12.431030),
            new google.maps.LatLng(46.689015,12.442703),
            new google.maps.LatLng(46.689486,12.446823),
            new google.maps.LatLng(46.689486,12.454376),
            new google.maps.LatLng(46.688073,12.456436),
            new google.maps.LatLng(46.687131,12.468796),
            new google.maps.LatLng(46.685718,12.476349),
            new google.maps.LatLng(46.676768,12.481155),
            new google.maps.LatLng(46.676768,12.492142),
            new google.maps.LatLng(46.678181,12.498322),
            new google.maps.LatLng(46.681479,12.502441),
            new google.maps.LatLng(46.678652,12.505875),
            new google.maps.LatLng(46.678652,12.518921),
            new google.maps.LatLng(46.673941,12.528534),
            new google.maps.LatLng(46.670643,12.528534),
            new google.maps.LatLng(46.667345,12.532654),
            new google.maps.LatLng(46.667345,12.536087),
            new google.maps.LatLng(46.660747,12.546387),
            new google.maps.LatLng(46.658862,12.547760),
            new google.maps.LatLng(46.657920,12.558746),
            new google.maps.LatLng(46.653207,12.560120),
            new google.maps.LatLng(46.652264,12.568359),
            new google.maps.LatLng(46.656506,12.577972),
            new google.maps.LatLng(46.656977,12.599258),
            new google.maps.LatLng(46.656035,12.603378),
            new google.maps.LatLng(46.658391,12.608871),
            new google.maps.LatLng(46.658391,12.612991),
            new google.maps.LatLng(46.661690,12.618484),
            new google.maps.LatLng(46.661690,12.631531),
            new google.maps.LatLng(46.656506,12.633591),
            new google.maps.LatLng(46.653678,12.639771),
            new google.maps.LatLng(46.651793,12.641144),
            new google.maps.LatLng(46.653207,12.651443),
            new google.maps.LatLng(46.656977,12.657623),
            new google.maps.LatLng(46.657920,12.666550),
            new google.maps.LatLng(46.658862,12.676849),
            new google.maps.LatLng(46.655563,12.680969),
            new google.maps.LatLng(46.657449,12.685776),
            new google.maps.LatLng(46.657449,12.689209),
            new google.maps.LatLng(46.666402,12.691269),
            new google.maps.LatLng(46.673470,12.688522),
            new google.maps.LatLng(46.675826,12.689209),
            new google.maps.LatLng(46.680537,12.683716),
            new google.maps.LatLng(46.687131,12.689209),
            new google.maps.LatLng(46.692783,12.693329),
            new google.maps.LatLng(46.703615,12.693329),
            new google.maps.LatLng(46.705498,12.707062),
            new google.maps.LatLng(46.702673,12.717361),
            new google.maps.LatLng(46.705498,12.719421),
            new google.maps.LatLng(46.714444,12.709808),
            new google.maps.LatLng(46.729978,12.715988),
            new google.maps.LatLng(46.734684,12.712555),
            new google.maps.LatLng(46.743154,12.724915),
            new google.maps.LatLng(46.747389,12.748260),
            new google.maps.LatLng(46.753035,12.763367),
            new google.maps.LatLng(46.752094,12.782593),
            new google.maps.LatLng(46.755857,12.800446),
            new google.maps.LatLng(46.755857,12.810059),
            new google.maps.LatLng(46.751153,12.814178),
            new google.maps.LatLng(46.751153,12.826538),
            new google.maps.LatLng(46.751153,12.838898),
            new google.maps.LatLng(46.758680,12.852631),
            new google.maps.LatLng(46.762443,12.874603),
            new google.maps.LatLng(46.774671,12.893829),
            new google.maps.LatLng(46.770909,12.906189),
            new google.maps.LatLng(46.768087,12.935028),
            new google.maps.LatLng(46.770909,12.944641),
            new google.maps.LatLng(46.778433,12.947388),
            new google.maps.LatLng(46.785016,12.961121),
            new google.maps.LatLng(46.793478,12.966614),
            new google.maps.LatLng(46.801000,12.951508),
            new google.maps.LatLng(46.812279,12.936401),
            new google.maps.LatLng(46.817918,12.918549),
            new google.maps.LatLng(46.824496,12.906189),
            new google.maps.LatLng(46.830134,12.892456),
            new google.maps.LatLng(46.836710,12.891083),
            new google.maps.LatLng(46.845164,12.884216),
            new google.maps.LatLng(46.847982,12.871857),
            new google.maps.LatLng(46.857374,12.856750),
            new google.maps.LatLng(46.860191,12.841644),
            new google.maps.LatLng(46.878968,12.843018),
            new google.maps.LatLng(46.892109,12.840271),
            new google.maps.LatLng(46.899616,12.833405),
            new google.maps.LatLng(46.910875,12.837524),
            new google.maps.LatLng(46.914627,12.830658),
            new google.maps.LatLng(46.916503,12.819672),
            new google.maps.LatLng(46.924945,12.810059),
            new google.maps.LatLng(46.924007,12.799072),
            new google.maps.LatLng(46.931510,12.783966),
            new google.maps.LatLng(46.939012,12.785339),
            new google.maps.LatLng(46.947450,12.768860),
            new google.maps.LatLng(46.954012,12.759247),
            new google.maps.LatLng(46.956824,12.759247),
            new google.maps.LatLng(46.963385,12.744141),
            new google.maps.LatLng(46.980252,12.738647),
            new google.maps.LatLng(46.994304,12.726288),
            new google.maps.LatLng(47.004607,12.737274),
            new google.maps.LatLng(47.013035,12.737274),
            new google.maps.LatLng(47.029886,12.755127),
            new google.maps.LatLng(47.035503,12.757874),
            new google.maps.LatLng(47.040182,12.768860),
            new google.maps.LatLng(47.046733,12.757874),
            new google.maps.LatLng(47.042054,12.744141),
            new google.maps.LatLng(47.043926,12.713928),
            new google.maps.LatLng(47.066380,12.701569),
            new google.maps.LatLng(47.083215,12.693329),
            new google.maps.LatLng(47.088826,12.675476),
            new google.maps.LatLng(47.100980,12.654877),
            new google.maps.LatLng(47.106588,12.635651),
            new google.maps.LatLng(47.116869,12.627411),
            new google.maps.LatLng(47.124345,12.605438),
            new google.maps.LatLng(47.126213,12.593079),
            new google.maps.LatLng(47.130885,12.588959),
            new google.maps.LatLng(47.136490,12.566986),
            new google.maps.LatLng(47.127148,12.549133),
            new google.maps.LatLng(47.141161,12.525787),
            new google.maps.LatLng(47.149567,12.521667),
            new google.maps.LatLng(47.152369,12.505188),
            new google.maps.LatLng(47.157972,12.498322),
            new google.maps.LatLng(47.158906,12.485962),
            new google.maps.LatLng(47.152369,12.477722),
            new google.maps.LatLng(47.152369,12.472229),
            new google.maps.LatLng(47.146766,12.466736),
            new google.maps.LatLng(47.143963,12.451630),
            new google.maps.LatLng(47.150501,12.433777),
            new google.maps.LatLng(47.143029,12.420044),
            new google.maps.LatLng(47.152369,12.398071),
            new google.maps.LatLng(47.145832,12.382965),
            new google.maps.LatLng(47.139293,12.365112),
            new google.maps.LatLng(47.132754,12.356873),
            new google.maps.LatLng(47.115934,12.358246),
            new google.maps.LatLng(47.106588,12.319794),
            new google.maps.LatLng(47.093501,12.308807),
            new google.maps.LatLng(47.096305,12.288208),
            new google.maps.LatLng(47.081345,12.270355),
            new google.maps.LatLng(47.071057,12.244263),
            new google.maps.LatLng(47.069479,12.241001),
            new google.maps.LatLng(47.072138,12.236881),
            new google.maps.LatLng(47.074447,12.232847),
            new google.maps.LatLng(47.081929,12.226925),
            new google.maps.LatLng(47.083741,12.218170),
            new google.maps.LatLng(47.086430,12.214136),
            new google.maps.LatLng(47.087408,12.204416),
            new google.maps.LatLng(47.089439,12.198129),
            new google.maps.LatLng(47.091806,12.186499),
            new google.maps.LatLng(47.090652,12.180512),
            new google.maps.LatLng(47.088329,12.177787),
            new google.maps.LatLng(47.087291,12.170856),
            new google.maps.LatLng(47.082331,12.163700),
            new google.maps.LatLng(47.082338,12.156372),
            new google.maps.LatLng(47.079898,12.151780),
            new google.maps.LatLng(47.079445,12.146330),
            new google.maps.LatLng(47.080161,12.141309),
            new google.maps.LatLng(47.080819,12.136545),
            new google.maps.LatLng(47.080877,12.135773),
            new google.maps.LatLng(47.081812,12.134657),
            new google.maps.LatLng(47.094435,12.126160),
            new google.maps.LatLng(47.108457,12.128906),
            new google.maps.LatLng(47.123410,12.112427),
            new google.maps.LatLng(47.136490,12.111053),
            new google.maps.LatLng(47.147700,12.091827),
            new google.maps.LatLng(47.164509,12.091827),
            new google.maps.LatLng(47.170111,12.086334),
            new google.maps.LatLng(47.180379,12.090454),
            new google.maps.LatLng(47.193445,12.083588),
            new google.maps.LatLng(47.199044,12.087708),
            new google.maps.LatLng(47.212106,12.086334),
            new google.maps.LatLng(47.251271,12.105560),
            new google.maps.LatLng(47.260592,12.091827),
            new google.maps.LatLng(47.268980,12.079468),
            new google.maps.LatLng(47.280161,12.083588),
            new google.maps.LatLng(47.285750,12.097321),
            new google.maps.LatLng(47.304378,12.112427),
            new google.maps.LatLng(47.298791,12.128906),
            new google.maps.LatLng(47.288545,12.142639),
            new google.maps.LatLng(47.291339,12.153625),
            new google.maps.LatLng(47.302516,12.168732),
            new google.maps.LatLng(47.298791,12.193451),
            new google.maps.LatLng(47.305310,12.211304),
            new google.maps.LatLng(47.311828,12.216797),
            new google.maps.LatLng(47.310897,12.233276),
            new google.maps.LatLng(47.304378,12.238770),
            new google.maps.LatLng(47.304378,12.257996),
            new google.maps.LatLng(47.304378,12.266235),
            new google.maps.LatLng(47.315552,12.281342),
            new google.maps.LatLng(47.323931,12.293701),
            new google.maps.LatLng(47.332308,12.296448),
            new google.maps.LatLng(47.328585,12.314301),
            new google.maps.LatLng(47.323000,12.339020),
            new google.maps.LatLng(47.309965,12.370605),
            new google.maps.LatLng(47.315552,12.389832),
            new google.maps.LatLng(47.316483,12.410431),
            new google.maps.LatLng(47.321138,12.420044),
            new google.maps.LatLng(47.327654,12.440643),
            new google.maps.LatLng(47.324861,12.472229),
            new google.maps.LatLng(47.337892,12.485962),
            new google.maps.LatLng(47.338823,12.494202),
            new google.maps.LatLng(47.348128,12.498322),
            new google.maps.LatLng(47.351850,12.485962),
            new google.maps.LatLng(47.361153,12.484589),
            new google.maps.LatLng(47.363013,12.481842),
            new google.maps.LatLng(47.375105,12.480469),
            new google.maps.LatLng(47.380684,12.496948),
            new google.maps.LatLng(47.392771,12.503815),
            new google.maps.LatLng(47.389982,12.520294),
            new google.maps.LatLng(47.394631,12.542267),
            new google.maps.LatLng(47.399279,12.560120),
            new google.maps.LatLng(47.395560,12.564240),
            new google.maps.LatLng(47.390912,12.580719),
            new google.maps.LatLng(47.405785,12.593079),
            new google.maps.LatLng(47.417867,12.609558),
            new google.maps.LatLng(47.420654,12.621918),
            new google.maps.LatLng(47.430874,12.627411),
            new google.maps.LatLng(47.439235,12.637024),
            new google.maps.LatLng(47.449451,12.634277),
            new google.maps.LatLng(47.462451,12.631531),
            new google.maps.LatLng(47.468021,12.639771),
            new google.maps.LatLng(47.467093,12.656250),
            new google.maps.LatLng(47.465236,12.665863),
            new google.maps.LatLng(47.473591,12.685089),
            new google.maps.LatLng(47.478232,12.697449),
            new google.maps.LatLng(47.488441,12.697449),
            new google.maps.LatLng(47.500503,12.668610),
            new google.maps.LatLng(47.504214,12.671356),
            new google.maps.LatLng(47.507925,12.661743),
            new google.maps.LatLng(47.534820,12.654877),
            new google.maps.LatLng(47.550579,12.631531),
            new google.maps.LatLng(47.553360,12.642517),
            new google.maps.LatLng(47.557994,12.643890),
            new google.maps.LatLng(47.565407,12.652130),
            new google.maps.LatLng(47.570040,12.652130),
            new google.maps.LatLng(47.577452,12.664490),
            new google.maps.LatLng(47.592273,12.646637),
            new google.maps.LatLng(47.598755,12.623291),
            new google.maps.LatLng(47.597829,12.606812),
            new google.maps.LatLng(47.601533,12.595825),
            new google.maps.LatLng(47.606163,12.579346),
            new google.maps.LatLng(47.612644,12.569733),
            new google.maps.LatLng(47.630231,12.573853),
            new google.maps.LatLng(47.636709,12.536774),
            new google.maps.LatLng(47.626529,12.513428),
            new google.maps.LatLng(47.624678,12.501068),
            new google.maps.LatLng(47.637634,12.491455),
            new google.maps.LatLng(47.649662,12.465363),
            new google.maps.LatLng(47.667237,12.451630),
            new google.maps.LatLng(47.673710,12.443390),
            new google.maps.LatLng(47.675560,12.439270),
            new google.maps.LatLng(47.690352,12.442017),
            new google.maps.LatLng(47.694974,12.440643),
            new google.maps.LatLng(47.696823,12.431030),
            new google.maps.LatLng(47.683881,12.366486),
            new google.maps.LatLng(47.692201,12.355499),
            new google.maps.LatLng(47.691277,12.352753),
            new google.maps.LatLng(47.694050,12.345886),
            new google.maps.LatLng(47.688504,12.340393),
            new google.maps.LatLng(47.692201,12.334900),
            new google.maps.LatLng(47.696823,12.337646),
            new google.maps.LatLng(47.691277,12.308807),
            new google.maps.LatLng(47.691277,12.279968),
            new google.maps.LatLng(47.678334,12.263489),
            new google.maps.LatLng(47.678334,12.253876),
            new google.maps.LatLng(47.682957,12.252502),
            new google.maps.LatLng(47.694050,12.241516),
            new google.maps.LatLng(47.710686,12.247009),
            new google.maps.LatLng(47.712534,12.251129),
            new google.maps.LatLng(47.732858,12.263489),
            new google.maps.LatLng(47.743017,12.255249),
            new google.maps.LatLng(47.741170,12.249756),
            new google.maps.LatLng(47.719001,12.225037),
            new google.maps.LatLng(47.710686,12.209930),
            new google.maps.LatLng(47.708837,12.203064),
            new google.maps.LatLng(47.708837,12.196198),
            new google.maps.LatLng(47.702368,12.185211),
            new google.maps.LatLng(47.699596,12.161865),
            new google.maps.LatLng(47.680183,12.167358),
            new google.maps.LatLng(47.669087,12.181091),
            new google.maps.LatLng(47.640410,12.198944),
            new google.maps.LatLng(47.625603,12.201691),
            new google.maps.LatLng(47.621901,12.205811),
            new google.maps.LatLng(47.607089,12.204437),
            new google.maps.LatLng(47.602459,12.176971),
            new google.maps.LatLng(47.613570,12.181091),
            new google.maps.LatLng(47.616347,12.165985),
            new google.maps.LatLng(47.605237,12.138519),
            new google.maps.LatLng(47.606163,12.127533),
            new google.maps.LatLng(47.611718,12.115173),
            new google.maps.LatLng(47.608941,12.082214),
            new google.maps.LatLng(47.613570,12.078094),
            new google.maps.LatLng(47.613570,12.071228),
            new google.maps.LatLng(47.619124,12.060242),
            new google.maps.LatLng(47.614496,12.053375),
            new google.maps.LatLng(47.618198,12.039642),
            new google.maps.LatLng(47.610792,12.025909),
            new google.maps.LatLng(47.623752,12.009430),
            new google.maps.LatLng(47.618198,11.984711),
            new google.maps.LatLng(47.612644,11.976471),
            new google.maps.LatLng(47.619124,11.969604),
            new google.maps.LatLng(47.612644,11.928406),
            new google.maps.LatLng(47.615421,11.911926),
            new google.maps.LatLng(47.608015,11.902313),
            new google.maps.LatLng(47.608941,11.894073),
            new google.maps.LatLng(47.601533,11.863861),
            new google.maps.LatLng(47.601533,11.854248),
            new google.maps.LatLng(47.583010,11.846008),
            new google.maps.LatLng(47.582084,11.832275),
            new google.maps.LatLng(47.585789,11.828156),
            new google.maps.LatLng(47.587642,11.792450),
            new google.maps.LatLng(47.591346,11.780090),
            new google.maps.LatLng(47.587642,11.743011),
            new google.maps.LatLng(47.588568,11.701813),
            new google.maps.LatLng(47.583937,11.682587),
            new google.maps.LatLng(47.586715,11.671600),
            new google.maps.LatLng(47.584863,11.661987),
            new google.maps.LatLng(47.590420,11.648254),
            new google.maps.LatLng(47.589494,11.645508),
            new google.maps.LatLng(47.594125,11.641388),
            new google.maps.LatLng(47.595977,11.634521),
            new google.maps.LatLng(47.587642,11.633148),
            new google.maps.LatLng(47.581158,11.631775),
            new google.maps.LatLng(47.584863,11.622162),
            new google.maps.LatLng(47.581158,11.615295),
            new google.maps.LatLng(47.583010,11.605682),
            new google.maps.LatLng(47.567261,11.600189),
            new google.maps.LatLng(47.558921,11.586456),
            new google.maps.LatLng(47.553360,11.589203),
            new google.maps.LatLng(47.545945,11.586456),
            new google.maps.LatLng(47.523693,11.586456),
            new google.maps.LatLng(47.519983,11.574097),
            new google.maps.LatLng(47.514418,11.569977),
            new google.maps.LatLng(47.514418,11.552124),
            new google.maps.LatLng(47.507925,11.531525),
            new google.maps.LatLng(47.512563,11.517792),
            new google.maps.LatLng(47.504214,11.508179),
            new google.maps.LatLng(47.506070,11.499939),
            new google.maps.LatLng(47.509780,11.487579),
            new google.maps.LatLng(47.506997,11.453247),
            new google.maps.LatLng(47.519056,11.442261),
            new google.maps.LatLng(47.506997,11.421661),
            new google.maps.LatLng(47.504214,11.421661),
            new google.maps.LatLng(47.501431,11.417542),
            new google.maps.LatLng(47.492153,11.407928),
            new google.maps.LatLng(47.485657,11.396942),
            new google.maps.LatLng(47.483801,11.390076),
            new google.maps.LatLng(47.473591,11.381836),
            new google.maps.LatLng(47.468950,11.388702),
            new google.maps.LatLng(47.467093,11.407928),
            new google.maps.LatLng(47.458737,11.412048),
            new google.maps.LatLng(47.446665,11.418915),
            new google.maps.LatLng(47.443879,11.406555),
            new google.maps.LatLng(47.448522,11.402435),
            new google.maps.LatLng(47.447594,11.390076),
            new google.maps.LatLng(47.449451,11.377716),
            new google.maps.LatLng(47.446665,11.372223),
            new google.maps.LatLng(47.444808,11.363983),
            new google.maps.LatLng(47.447594,11.358490),
            new google.maps.LatLng(47.447594,11.352997),
            new google.maps.LatLng(47.449451,11.342010),
            new google.maps.LatLng(47.444808,11.332397),
            new google.maps.LatLng(47.440164,11.331024),
            new google.maps.LatLng(47.438306,11.321411),
            new google.maps.LatLng(47.431803,11.311798),
            new google.maps.LatLng(47.430874,11.300812),
            new google.maps.LatLng(47.427158,11.291199),
            new google.maps.LatLng(47.421583,11.289825),
            new google.maps.LatLng(47.418796,11.293945),
            new google.maps.LatLng(47.410432,11.288452),
            new google.maps.LatLng(47.406715,11.289825),
            new google.maps.LatLng(47.397420,11.273346),
            new google.maps.LatLng(47.399279,11.262360),
            new google.maps.LatLng(47.400208,11.239014),
            new google.maps.LatLng(47.394631,11.223907),
            new google.maps.LatLng(47.398349,11.221161),
            new google.maps.LatLng(47.402067,11.223907),
            new google.maps.LatLng(47.404856,11.229401),
            new google.maps.LatLng(47.412291,11.229401),
            new google.maps.LatLng(47.415079,11.236267),
            new google.maps.LatLng(47.418796,11.240387),
            new google.maps.LatLng(47.429016,11.252747),
            new google.maps.LatLng(47.433661,11.248627),
            new google.maps.LatLng(47.432732,11.222534),
            new google.maps.LatLng(47.434590,11.206055),
            new google.maps.LatLng(47.428087,11.197815),
            new google.maps.LatLng(47.427158,11.177216),
            new google.maps.LatLng(47.420654,11.164856),
            new google.maps.LatLng(47.422513,11.157990),
            new google.maps.LatLng(47.413220,11.136017),
            new google.maps.LatLng(47.412291,11.129150),
            new google.maps.LatLng(47.406715,11.120911),
            new google.maps.LatLng(47.400208,11.122284),
            new google.maps.LatLng(47.395560,11.112671),
            new google.maps.LatLng(47.394631,11.096191),
            new google.maps.LatLng(47.397420,11.060486),
            new google.maps.LatLng(47.396490,11.048126),
            new google.maps.LatLng(47.396490,11.038513),
            new google.maps.LatLng(47.393701,11.027527),
            new google.maps.LatLng(47.398349,11.024780),
            new google.maps.LatLng(47.393701,10.998688),
            new google.maps.LatLng(47.396490,10.993195),
            new google.maps.LatLng(47.394631,10.987701),
            new google.maps.LatLng(47.399279,10.969849),
            new google.maps.LatLng(47.412291,10.971222),
            new google.maps.LatLng(47.416937,10.972595),
            new google.maps.LatLng(47.420190,10.983067),
            new google.maps.LatLng(47.420190,10.985126),
            new google.maps.LatLng(47.430410,10.983753),
            new google.maps.LatLng(47.454559,10.952682),
            new google.maps.LatLng(47.462451,10.938950),
            new google.maps.LatLng(47.472663,10.928650),
            new google.maps.LatLng(47.480088,10.938263),
            new google.maps.LatLng(47.483337,10.934830),
            new google.maps.LatLng(47.481017,10.927277),
            new google.maps.LatLng(47.486585,10.910110),
            new google.maps.LatLng(47.482873,10.896378),
            new google.maps.LatLng(47.478696,10.883331),
            new google.maps.LatLng(47.481481,10.873718),
            new google.maps.LatLng(47.485657,10.868912),
            new google.maps.LatLng(47.494009,10.871658),
            new google.maps.LatLng(47.498184,10.870972),
            new google.maps.LatLng(47.504214,10.880585),
            new google.maps.LatLng(47.507461,10.890884),
            new google.maps.LatLng(47.510244,10.904617),
            new google.maps.LatLng(47.511636,10.906677),
            new google.maps.LatLng(47.514418,10.917664),
            new google.maps.LatLng(47.517664,10.917664),
            new google.maps.LatLng(47.519983,10.913544),
            new google.maps.LatLng(47.517664,10.904617),
            new google.maps.LatLng(47.520910,10.901871),
            new google.maps.LatLng(47.528329,10.894318),
            new google.maps.LatLng(47.536674,10.890198),
            new google.maps.LatLng(47.535747,10.867538),
            new google.maps.LatLng(47.534356,10.861359),
            new google.maps.LatLng(47.536211,10.853806),
            new google.maps.LatLng(47.525779,10.837669),
            new google.maps.LatLng(47.528097,10.833549),
            new google.maps.LatLng(47.527170,10.811920),
            new google.maps.LatLng(47.519519,10.810547),
            new google.maps.LatLng(47.522302,10.795441),
            new google.maps.LatLng(47.514882,10.778961),
            new google.maps.LatLng(47.519983,10.764542),
            new google.maps.LatLng(47.529257,10.763168),
            new google.maps.LatLng(47.538528,10.750122),
            new google.maps.LatLng(47.539455,10.717163),
            new google.maps.LatLng(47.544091,10.708923),
            new google.maps.LatLng(47.545018,10.696564),
            new google.maps.LatLng(47.559847,10.693817),
            new google.maps.LatLng(47.556140,10.682831),
            new google.maps.LatLng(47.559847,10.675964),
            new google.maps.LatLng(47.560774,10.629272),
            new google.maps.LatLng(47.569114,10.618286),
            new google.maps.LatLng(47.566334,10.608673),
            new google.maps.LatLng(47.570967,10.599060),
            new google.maps.LatLng(47.562627,10.593567),
            new google.maps.LatLng(47.556140,10.578461),
            new google.maps.LatLng(47.550579,10.579834),
            new google.maps.LatLng(47.534820,10.571594),
            new google.maps.LatLng(47.534820,10.563354),
            new google.maps.LatLng(47.537601,10.555115),
            new google.maps.LatLng(47.533893,10.524902),
            new google.maps.LatLng(47.542237,10.486450),
            new google.maps.LatLng(47.550579,10.471344),
            new google.maps.LatLng(47.557067,10.453491),
            new google.maps.LatLng(47.570040,10.472717),
            new google.maps.LatLng(47.579305,10.469971),
            new google.maps.LatLng(47.583010,10.480957),
            new google.maps.LatLng(47.586715,10.471344),
            new google.maps.LatLng(47.587642,10.465851),
            new google.maps.LatLng(47.583937,10.456238),
            new google.maps.LatLng(47.585789,10.437012),
            new google.maps.LatLng(47.578379,10.430145),
            new google.maps.LatLng(47.570967,10.432892),
            new google.maps.LatLng(47.566334,10.443878),
            new google.maps.LatLng(47.557067,10.449371),
            new google.maps.LatLng(47.554287,10.453491),
            new google.maps.LatLng(47.523693,10.438385),
            new google.maps.LatLng(47.520910,10.441132),
            new google.maps.LatLng(47.514418,10.438385),
            new google.maps.LatLng(47.503287,10.430145),
            new google.maps.LatLng(47.484729,10.442505),
            new google.maps.LatLng(47.485657,10.452118),
            new google.maps.LatLng(47.484729,10.460358),
            new google.maps.LatLng(47.477304,10.467224),
            new google.maps.LatLng(47.468950,10.467224),
            new google.maps.LatLng(47.466165,10.465851),
            new google.maps.LatLng(47.457809,10.467224),
            new google.maps.LatLng(47.455023,10.464478),
            new google.maps.LatLng(47.433661,10.475464),
            new google.maps.LatLng(47.432732,10.471344),
            new google.maps.LatLng(47.429945,10.457611),
            new google.maps.LatLng(47.419725,10.456238),
            new google.maps.LatLng(47.414614,10.445938),
            new google.maps.LatLng(47.414614,10.439072),
            new google.maps.LatLng(47.409968,10.434265),
            new google.maps.LatLng(47.406715,10.435638),
            new google.maps.LatLng(47.402532,10.431519),
            new google.maps.LatLng(47.401138,10.433578),
            new google.maps.LatLng(47.390912,10.430832),
            new google.maps.LatLng(47.381614,10.435638),
            new google.maps.LatLng(47.383939,10.430832),
            new google.maps.LatLng(47.386728,10.419159),
            new google.maps.LatLng(47.379754,10.413666),
            new google.maps.LatLng(47.378824,10.402679),
            new google.maps.LatLng(47.372315,10.390320),
            new google.maps.LatLng(47.364874,10.386200),
            new google.maps.LatLng(47.357432,10.384827),
            new google.maps.LatLng(47.355571,10.380707),
            new google.maps.LatLng(47.351850,10.377960),
            new google.maps.LatLng(47.338823,10.357361),
            new google.maps.LatLng(47.333239,10.355988),
            new google.maps.LatLng(47.321603,10.344315),
            new google.maps.LatLng(47.318345,10.348434),
            new google.maps.LatLng(47.315552,10.345688),
            new google.maps.LatLng(47.314155,10.340195),
            new google.maps.LatLng(47.311362,10.340195),
            new google.maps.LatLng(47.304378,10.325089),
            new google.maps.LatLng(47.307172,10.316162),
            new google.maps.LatLng(47.299256,10.300369),
            new google.maps.LatLng(47.299722,10.294876),
            new google.maps.LatLng(47.295065,10.291443),
            new google.maps.LatLng(47.288545,10.281830),
            new google.maps.LatLng(47.289011,10.267410),
            new google.maps.LatLng(47.285285,10.266724),
            new google.maps.LatLng(47.279695,10.248871),
            new google.maps.LatLng(47.282024,10.246124),
            new google.maps.LatLng(47.271775,10.233765),
            new google.maps.LatLng(47.275968,10.223465),
            new google.maps.LatLng(47.275036,10.209045),
            new google.maps.LatLng(47.277831,10.201492),
            new google.maps.LatLng(47.273173,10.193253),
            new google.maps.LatLng(47.270843,10.178318)
        ];
        var polyOptions = {
        path: myCoordinates,
        strokeColor: "#000000",
        strokeOpacity: 1,
        strokeWeight: 4
        };
    var it = new google.maps.Polyline(polyOptions);
    it.setMap(map);
    }

    initialize();


});