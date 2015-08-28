/**
 * Author:  Diarmuid Ryan
 *          ADAPT Centre,
 *          Trinity College Dublin
 *
 * Last Modified:   25/08/15
 */

//var graph = "http://localhost:8080/fuseki/rdf_stf/data/knoholem_Ifc";
var graph = "http://localhost:8080/fuseki/rdf_stf/data/new";
var queryEnd = "http://localhost:8080/fuseki/rdf_stf/";
var updateEnd = "http://localhost:8080/fuseki/rdf_stf/update";
var sparql = new SPARQL(queryEnd, updateEnd, graph);
sparql.addPrefix("PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> " +
    "PREFIX ifc: <http://www.buildingsmart-tech.org/ifcOWL#> " +
    "PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> " +
    "PREFIX cart: <http://purl.org/net/cartCoord#> " +
    "PREFIX fn: <http://www.w3.org/2005/xpath-functions#> ");

var DEST_URI = "http://something/example#";

var clickedCoords = [];
var clickedCoordsForSensor = [];
var clickedCoordsForWall = [];
var pointsForAddingRoom = [];

var width, height = 400;

var sensors_dict;
var objects;
var walls;

var scene,renderer;

var canvasName = "buildingPlan";
var detailsName = "details";
var inDepthName = "inDepth";
var putClickedCoords = "putCoordsHere";

var planContainer;

var defaultColours = {
    room: {default: 0xa2a2a2, highlight: 0xb82e7c, edge: 0x838383},
    sensor: {default: 0xd8d8d8, highlight: 0x121011}
};

var sensors = new SENSORS(CONTROLS, sparql);
var SENSOR_DETAILS = new sensors.DETAILS(inDepthName);
var MODIFY_SENSOR = new sensors.MODIFY(detailsName);

CONTROLS.relocate = new BUTTON("relocateOuter");
CONTROLS.relocate.setDropdown("relocateDropdown");
CONTROLS.edit = new BUTTON("editSensorOuter");
CONTROLS.addSensor = new BUTTON("addSensorOuter");
CONTROLS.addOpening = new BUTTON("addOpening");

var myCam;

function init() {

    planContainer = document.getElementById(canvasName);
    width = planContainer.clientWidth;

    renderer = new THREE.WebGLRenderer({alpha: true});
    renderer.setSize( width, height );
    planContainer.appendChild( renderer.domElement );

    planContainer.addEventListener('mousedown', onCanvasMouseDown, false);
    window.addEventListener('resize', onResize, true);

    ROOM_DETAILS.setContainer(detailsName);

    SENSOR_DETAILS.setVariable('Type', SENSOR_DETAILS.param.uri + ' rdf:type ' + SENSOR_DETAILS.param.val);
    SENSOR_DETAILS.setVariable('Enumerable Type',
        ' {' + SENSOR_DETAILS.param.uri + ' ifc:PredefinedType_of_IfcSensor ' + SENSOR_DETAILS.param.val + ' }' +
        'UNION {' + SENSOR_DETAILS.param.uri + ' ifc:PredefinedType_of_IfcFlowMeter ' +SENSOR_DETAILS.param.val+ ' } ');
    SENSOR_DETAILS.setVariable('Cost', SENSOR_DETAILS.param.uri + ' ifc:HasAssignments ?rag . ' +
        '?rag ifc:RelatingGroup ?asset . ?asset ifc:currentValue_of_IfcAsset ' +SENSOR_DETAILS.param.val);
    SENSOR_DETAILS.setVariable('Coordinates', SENSOR_DETAILS.param.uri + ' cart:hasPlacement ?point . ' +
        '?point cart:xcoord ?x . ?point cart:ycoord ?y . ' +
        'BIND (fn:concat(?x, ", ", ?y) AS '+SENSOR_DETAILS.param.val+')');

    fullscreenOn = true;

    getUriToDisplay();
}

function getUriToDisplay () {
    document.getElementById(detailsName).innerHTML = '<form role="form" id="getNs"> ' +
        '<div class="form-group"> ' +
        '<label for="name">Enter NameSpace:</label> ' +
        '<input type="text" class="form-control" id="name"> ' +
        '<button type="submit" class="btn btn-default" onClick=newProject("getNs"); >Load</button></form>';
}

function newProject(id) {
    DEST_URI = document.getElementById(id).elements[0].value;
    document.getElementById(detailsName).innerHTML = "Loading...";
    myCam = new CAMERA(width / height);
    scene = new THREE.Scene();
    sensors_dict = {};
    objects = [];
    walls = [];
    var grid = new THREE.GridHelper(100, 1);
    grid.rotation.x = Math.PI / 2;
    scene.add(grid);
    animate_sensors_cart();
    animate_rooms_cart();
    animate_rooms_ifc();
    document.getElementById(detailsName).innerHTML = "";
    render();
}

function render() {
    renderer.render(scene, myCam.cam());
    myCam.slow_zoom();
    requestAnimationFrame(render);
}

var fullscreenOn;
var originalWidth;

function fullscreen() {
    if(fullscreenOn == true) {
        originalWidth = width;
        width = window.innerWidth;
        height = window.innerHeight;
        fullscreenOn = false;
    } else {
        width = originalWidth;
        height = 400;
        fullscreenOn = true;
    }
    renderer.setSize( width, height );
    myCam.adjustAspect(width / height);
}

function onResize() {
    width = planContainer.clientWidth;
    // notify the renderer of the size change
    renderer.setSize( width, height );
    // update the camera
    myCam.adjustAspect(width / height);
}

function getClickedDirection (event) {
    var vector = new THREE.Vector3(( (event.clientX - planContainer.offsetLeft) / width ) * 2 - 1,
        -( (event.clientY - planContainer.offsetTop) / height ) * 2 + 1, 0.5);
    vector = vector.unproject(myCam.cam());
    return vector.sub(myCam.cam().position).normalize();
}

var clickedWall;
var addingSensor = false, addingRoom = false, addingOpening = false;

function onCanvasMouseDown(event) {
    this.clickedRoom = function(room) {
        ROOM_DETAILS.selectRoom(room.uri);
        CONTROLS.addSensor.enable();
        CONTROLS.addOpening.enable();
        room.material.color.setHex(defaultColours.room.highlight);
        if(!myCam.zoom.out) {
            myCam.zoom.lastObject.material.color.setHex(defaultColours.room.default);
            var selectedSensor = MODIFY_SENSOR.getSelectedSensor();
            if(selectedSensor != null && selectedSensor != "") {
                sensors_dict[selectedSensor].material.color.setHex(defaultColours.sensor.default);
            }
            MODIFY_SENSOR.selectSensor("");
            CONTROLS.relocate.clearContent();
            SENSOR_DETAILS.clear();
        }
        myCam.zoom_camera(room);
        if(myCam.zoom.out) {
            CONTROLS.addSensor.disable();
            CONTROLS.addOpening.disable();
        }
        ROOM_DETAILS.getSensors(room.uri);
    };

    var direction = getClickedDirection(event);
    var raycaster = new THREE.Raycaster(myCam.cam().position, direction);
    var intersects = raycaster.intersectObjects(objects, true);
    if(addingOpening) {
        var intersectsWall = raycaster.intersectObjects(walls, true);
        if (intersectsWall.length > 0) {
            var vectorWall = new THREE.Vector3().copy(intersectsWall[0].point);
            clickedCoordsForWall.push([vectorWall.x, vectorWall.y, vectorWall.z]);
            clickedWall = intersectsWall[0].object.uri;
        }
    } else if (addingRoom) {
        document.removeEventListener('mousedown', onCanvasMouseDown, false);
        document.addEventListener('mousemove', onMouseMove, false);
        document.addEventListener('click', onClick, false);
    } else if (addingSensor) {
        if (intersects.length > 0) {
            var vectorb = new THREE.Vector3().copy( intersects[ 0 ].point );
            clickedCoordsForSensor.push([vectorb.x, vectorb.y, vectorb.z]);
            document.getElementById(putClickedCoords).innerHTML = vectorb.x+','+vectorb.y;
        }
    } else {
        if (intersects.length > 0) {
            var i = 0;
            if(myCam.zoom.out) {
                while (intersects[i].object.myType != "room") {
                    i++;
                }
            }
            if(intersects[i].object.myType == "room") {
                this.clickedRoom(intersects[i].object);
            }
            if(intersects[0].object.myType == "sensor") {
                ROOM_DETAILS.pickSensor(intersects[0].object.uri);
            }
        }
    }
}

var addedObj = null;
var creating;
function onClick (event) {
    var direction = getClickedDirection(event);
    var distance = - myCam.cam().position.z / direction.z;
    var position = myCam.cam().position.clone().add(direction.multiplyScalar(distance));
    var x = Math.round(position.x);
    var y = Math.round(position.y);
    if(!creating) {
        clickedCoords[0] = [x, y];
        creating = true;
    } else if (clickedCoords[0][0] == x && clickedCoords[0][1] == y) {
        creating = false;
        scene.remove(addedObj);
        scene.add(addObj());
        addedObj = null;
        document.removeEventListener('mousemove', onMouseMove, false);
        document.removeEventListener('click', onClick, false);
        planContainer.addEventListener('mousedown', onCanvasMouseDown, false);
    } else {
        if(addedObj != null) {
            scene.remove(addedObj);
        }
        var point = [x, y];
        clickedCoords.push(point);
        addedObj = addObj();
        scene.add(addedObj);
    }
}

function addObj(extraCoord) {
    var object = new THREE.Shape();
    object.moveTo(clickedCoords[0][0], clickedCoords[0][1]);
    for(var i = 1; i < clickedCoords.length; i ++) {
        object.lineTo(clickedCoords[i][0], clickedCoords[i][1]);
    }
    if(extraCoord != null) {
        object.lineTo(extraCoord[0], extraCoord[1]);
    }
    var geom = new THREE.ShapeGeometry(object);
    return new THREE.Mesh(geom, new THREE.MeshBasicMaterial({color: 0xff0000}));
}

function onMouseMove (event) {
    if (creating) {
        var direction = getClickedDirection(event);
        var distance = - myCam.cam().position.z / direction.z;
        var position = myCam.cam().position.clone().add(direction.multiplyScalar(distance));
        if(addedObj != null) {
            scene.remove(addedObj);
        }
        if(clickedCoords.length > 1) {
            var point = [position.x, position.y];
            addedObj = addObj(point);
            scene.add(addedObj);
        }
    }
}

function animate_sensors_cart() {
    var query = 'SELECT ?sensor ?x ?y FROM <' + sparql.getGraph() + '> WHERE { ' +
        '{ ?sensor rdf:type ifc:IfcSensor } UNION { ?sensor rdf:type ifc:IfcFlowMeter } . ' +
        '?sensor cart:hasPlacement ?pos . ' +
        '?pos cart:xcoord ?x . ' +
        '?pos cart:ycoord ?y . ' +
        'FILTER(STRSTARTS(STR(?sensor), "' + DEST_URI + '")) . ' +
        '} ';
    var results = sparql.simpleQuery(query);
    for(var i = 0; i < results.length; i++) {
        var xcoord = parseFloat(results[i].x.value);
        var ycoord = parseFloat(results[i].y.value);
        addSensor(results[i].sensor.value, xcoord, ycoord);
        myCam.add_coord_range(xcoord, ycoord);
    }
}

function addSensor (uri, x, y) {
    var sensor = new THREE.Mesh(new THREE.BoxGeometry(0.1,0.1,0.1),
        new THREE.MeshBasicMaterial({color: defaultColours.sensor.default}));
    sensor.position.x = x;
    sensor.position.y = y;
    sensor.uri = uri;
    scene.add(sensor);
    sensors_dict[sensor.uri] = sensor;
    sensor.myType = "sensor";
    objects.push(sensor);
}

function animate_rooms_cart() {
    var query = 'SELECT ?space ?x ?y ' +
        'FROM <' + sparql.getGraph() + '> ' +
        'WHERE { ?space rdf:type ifc:IfcSpace .' +
        '?space cart:hasPlacement ?pos . ' +
        '?pos cart:hasPoint ?point . ' +
        '?point cart:xcoord ?x . ' +
        '?point cart:ycoord ?y . ' +
        'FILTER(STRSTARTS(STR(?space), "' + DEST_URI + '"))' +
        '} ';
    var results = sparql.simpleQuery(query);
    for(var i = 0; i < results.length; i++) {
        var room_name = results[i]["space"].value;
        var coordinates = [];
        while ((i < results.length) && (room_name == results[i]["space"].value)) {
            coordinates.push([parseFloat(results[i].x.value), parseFloat(results[i].y.value)]);
            i++;
        }
        addRoom(room_name, coordinates);
        addWallsForRoom(room_name);
        i--;
    }
}

function animate_rooms_ifc() {
    var query = 'PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>'+
        'PREFIX ifc: <http://www.buildingsmart-tech.org/ifcOWL#>'+
        'SELECT ?room ?coord FROM <'+sparql.getGraph()+'> '+
        'WHERE { ?room rdf:type ifc:IfcSpace ' +
        'FILTER(STRSTARTS(STR(?room), "' + DEST_URI + '")) }';
    var results = sparql.simpleQuery(query);
    var first_overall = true;
    for(var i = 0; i < results.length; i++) {
        var room = new THREE.Shape();
        var firstRun = true;
        var roomName = results[i].room.value;
        query = 'SELECT ?next ?x ?y FROM <'+sparql.getGraph()+'> '+
            'WHERE { <' + roomName + '> ifc:Representation ?rep . '+
            '?rep ifc:Representations ?repList . ' +
            '?repList ifc:hasListContent ?a . '+
            '?a ifc:Items ?z . '+
            '?z ifc:Bounds ?s . '+
            '?s ifc:Bound ?t . '+
            '?t ifc:Polygon ?ptlist . ' +
            '{ ?ptlist ifc:hasNext ?next } UNION ' +
            '{ ?ptlist ifc:hasListContent ?point . ' +
            '?point ifc:Coordinates_of_IfcCartesianPoint ?loop . ' +
            '?loop ifc:hasListContent ?x . ' +
            '?loop ifc:hasNext ?loop2 . ' +
            '?loop2 ifc:hasListContent ?y } ' +
            '}';
        var points = sparql.simpleQuery(query);
        var coord_results = [];
        while (points.length > 1) {
            console.log("looping");
            var next = points[0]["next"].value;
            coord_results.push([parseFloat(points[1]["x"].value), parseFloat(points[1]["y"].value)]);
            query = 'SELECT ?next ?x ?y FROM <'+sparql.getGraph()+'> '+
                'WHERE { ' +
                '{ <' + next + '> ifc:hasNext ?next } UNION ' +
                '{ <' + next + '> ifc:hasListContent ?point . ' +
                '?point ifc:Coordinates_of_IfcCartesianPoint ?loop . ' +
                '?loop ifc:hasListContent ?x . ' +
                '?loop ifc:hasNext ?loop2 . ' +
                '?loop2 ifc:hasListContent ?y } ' +
                '}';
            points = sparql.simpleQuery(query);
        }
        coord_results.push([parseFloat(points[0]["x"].value), parseFloat(points[0]["y"].value)]);
        addRoom(roomName, coord_results);
        addWallsForRoom(roomName);
    }
}

var wallMaterial = new THREE.MeshBasicMaterial({color: 0x00ff00, transparent: true, opacity: 0.2});
var openingMaterial = new THREE.MeshBasicMaterial({color: 0x0000ff, transparent: true, opacity: 0.2});

function addWallsForRoom (room_uri) {

    this.addWall = function (sectionUri, wallUri) {
        query = 'SELECT ?x ?y ?z FROM <'+sparql.getGraph()+'> WHERE { ' +
            '<'+sectionUri+'> ifc:ConnectionGeometry ?csg . ' +
            '?csg ifc:SurfaceOnRelatingElement ?cbp . ' +
            '?cbp ifc:OuterBoundary ?line . ' +
            '?line ifc:Points ?list . ' +
            '?list ifc:hasListContent ?point . ' +
            '?point ifc:Coordinates ?coord . ' +
            '?coord ifc:hasListContent ?x . ' +
            '?coord ifc:hasNext ?coord1 . ' +
            '?coord1 ifc:hasListContent ?y . ' +
            '?coord1 ifc:hasNext ?coord2 . ' +
            '?coord2 ifc:hasListContent ?z }';
        var coords = sparql.simpleQuery(query);
        /* An alternative representation for walls is in the comment below it was removed to allow for variable height*/
        //var x1 = parseFloat(coords[0].x.value);
        //var x2 = parseFloat(coords[1].x.value);
        //var y1 = parseFloat(coords[0].y.value);
        //var y2 = parseFloat(coords[1].y.value);
        //var height = parseFloat(coords[2].z.value);
        //var length = Math.sqrt(Math.pow((x2 - x1), 2) + Math.pow((y2- y1), 2));
        //var width = 0.2;
        //var angle = Math.atan((y1 - y2) / (x1 - x2));
        //if(length < 0) {
        //    length = 0 - length;
        //}
        //var wallMesh = new THREE.Mesh(new THREE.BoxGeometry(width, length ,height), wallMaterial);
        //wallMesh.position.x = (x1 + x2 )/ 2;
        //wallMesh.position.y = (y1 + y2 )/ 2;
        //wallMesh.position.z = height / 2;
        //wallMesh.rotation.z = (Math.PI / 2) + angle;
        var coordinates = [];
        for(var i = 0; i < coords.length; i++) {
            coordinates.push([parseFloat(coords[i].x.value), parseFloat(coords[i].y.value), parseFloat(coords[i].z.value)])
        }
        var wallMesh = drawUprightBox(coordinates, wallMaterial);
        wallMesh.uri = wallUri;
        wallMesh.renderOrder = 1;
        scene.add(wallMesh);
        walls.push(wallMesh);
    };

    var query = 'SELECT ?section ?wall FROM <'+sparql.getGraph()+'> WHERE { ' +
        '?bound ifc:RelatingSpace <' + room_uri +'> . ' +
        '?bound rdf:type ifc:IfcRelSpaceBoundary2ndLevel . ' +
        '?bound ifc:InnerBoundaries ?section . ' +
        '?section ifc:RelatedBuildingElement ?wall }';
    var boundary_results = sparql.simpleQuery(query);
    for(var i = 0; i < boundary_results.length; i++) {
        this.addWall(boundary_results[i]["section"].value, boundary_results[i]["wall"].value);
        addOpening(boundary_results[i]["wall"].value);
    }
}

function addOpening (wallUri) {
    this.addDoor = function (doorUri) {
        query = 'SELECT ?x0 ?y0 ?x1 ?x2 ?x3 ?y1 ?y2 ?y3 ?z0 ?z1 ?z2 ?z3 FROM <' + sparql.getGraph() + '> WHERE { ' +
            '<'+doorUri+'> ifc:Representation ?repList . ' +
            '?repList ifc:hasListContent ?rep . ' +
            '?rep ifc:Items ?line . ' +
            '?line ifc:Points ?pointList0 . ';
        for(var i = 0; i < 4; i++) {
            query +=
                '?pointList' + i + ' ifc:hasListContent ?point' + i + ' . ' +
                '?point' + i + ' ifc:Coordinates ?lengthList' + i + 'x . ' +
                '?lengthList' + i + 'x ifc:hasListContent ?x' + i + ' . ' +
                '?lengthList' + i + 'x ifc:hasNext ?lengthList' + i + 'y . ' +
                '?lengthList' + i + 'y ifc:hasListContent ?y' + i + ' . ' +
                '?lengthList' + i + 'y ifc:hasNext ?lengthList' + i + 'z . ' +
                '?lengthList' + i + 'z ifc:hasListContent ?z' + i + ' . ';
            if (i != 3) {
                var next = i + 1;
                query += '?pointList' + i + ' ifc:hasNext ?pointList' + next + ' .' ;
            }
        }
        query += ' } ';
        var results = sparql.simpleQuery(query);
        if(results.length > 0) {
            var coords = [];
            for (var j = 0; j < 4; j++) {
                var x = 'x' + j;
                var y = 'y' + j;
                var z = 'z' + j;
                coords.push([results[0][x].value, results[0][y].value, results[0][z].value]);
                var point = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1),
                    new THREE.MeshBasicMaterial({color: 0xff0000}));
                point.position.x = results[0][x].value;
                point.position.y = results[0][y].value;
                point.position.z = results[0][z].value;
                scene.add(point);
            }
            var opening = drawUprightBox(coords, openingMaterial);
            scene.add(opening);
        }
    };

    var query = 'SELECT ?windoor ?type FROM <' + sparql.getGraph() + '> WHERE { ' +
        '<'+wallUri+'> ifc:HasOpenings ?void . ' +
        '?void ifc:RelatedOpeningElement ?open . ' +
        '?open ifc:HasFillings ?fill . ' +
        '?fill ifc:RelatedBuildingElement ?windoor . ' +
        '?windoor rdf:type ?type . ' +
        '}';
    var results = sparql.simpleQuery(query);
    for(var i = 0; i < results.length; i++) {
        var type = results[i].type.value;
        var uri = results[i]["windoor"].value;
        //if(type.indexOf("IfcDoor") > -1) {
        this.addDoor(uri);
        //} else if (type.indexOf("IfcWindow") > -1){
        //    this.addWindow(uri);
        //}
    }
}

function drawUprightBox(coords, material) {
    var geometry = new THREE.Geometry();
    for(var i =0; i < coords.length; i++) {
        geometry.vertices.push(new THREE.Vector3( coords[i][0],  coords[i][1], coords[i][2] ));
    }
    geometry.faces.push(new THREE.Face3(0, 1, 2));
    geometry.faces.push(new THREE.Face3(0, 2, 3));
    geometry.faces.push(new THREE.Face3(2, 1, 0));
    geometry.faces.push(new THREE.Face3(3, 2, 0));
    return new THREE.Mesh(geometry, material);
}

function drawBox(coords) {
    var box = new THREE.Shape();
    box.moveTo(coords[0][0], coords[0][1]);
    myCam.add_coord_range(coords[0][0], coords[0][1]);
    for(var i = 1; i < coords.length; i++) {
        box.lineTo(coords[i][0], coords[i][1]);
        myCam.add_coord_range(coords[i][0], coords[i][1]);
    }
    var geom = new THREE.ShapeGeometry(box);
    return new THREE.Mesh( geom, new THREE.MeshBasicMaterial({color: defaultColours.room.default}) );
}

function addRoom(uri, coordinates) {
    var roomMesh = drawBox(coordinates, true);
    roomMesh.uri = uri;
    scene.add(roomMesh);
    roomMesh.myType = "room";
    objects.push(roomMesh);
    var edge = new THREE.EdgesHelper( roomMesh, defaultColours.room.edge );
    edge.material.linewidth = 2;
    scene.add( edge );
}

var CAMERA = function (aspectRatio) {

    var maxmin = {x: {max: null, min: null}, y: {max: null, min: null}, first:true};

    this.cam = function () {
        return camera;
    };

    this.adjustAspect = function (aspectRatio) {
        camera.aspect = aspectRatio;
        camera.updateProjectionMatrix();
    };

    this.setPosition = function (x,y,z) {
        camera.position.x = parseFloat(x);
        camera.position.y = parseFloat(y);
        camera.position.z = parseFloat(z);
    };

    this.slow_zoom = function () {
        if(this.zoom.destination.x != camera.position.x) {
            camera.position.x += 0.1 * (this.zoom.destination.x - camera.position.x);
        }
        if(this.zoom.destination.y != camera.position.y) {
            camera.position.y += 0.1 * (this.zoom.destination.y - camera.position.y);
        }
        if(this.zoom.destination.z != camera.position.z) {
            camera.position.z += 0.1 * (this.zoom.destination.z - camera.position.z);
        }
    };

    this.zoom_camera = function (object) {
        if(this.zoom.lastObject == object) {
            this.zoom.destination.x = this.zoom.default.x;
            this.zoom.destination.y = this.zoom.default.y;
            this.zoom.destination.z = this.zoom.default.z;
            this.zoom.lastObject = null;
            this.zoom.out = true;
        } else {
            this.zoom.out = false;
            var vertices = object["geometry"]["vertices"];
            var xpos = vertices[0]["x"];
            var xneg = vertices[0]["x"];
            var ypos = vertices[0]["y"];
            var yneg = vertices[0]["y"];
            for (var i = 1; i < vertices.length; i++) {
                var verX = vertices[i]["x"];
                var verY = vertices[i]["y"];
                if (verX > xpos) {
                    xpos = verX;
                } else if (xneg > verX) {
                    xneg = verX;
                }
                if (verY > ypos) {
                    ypos = verY;
                } else if (yneg > verY) {
                    yneg = verY;
                }
            }
            var coords = this.get_camera_coords(xpos, xneg, ypos, yneg);
            this.zoom.destination.x = coords.x;
            this.zoom.destination.y = coords.y;
            this.zoom.destination.z = coords.z;
            this.zoom.lastObject = object;
        }
    };

    this.setCameraCoords = function (largeX, smallX, largeY, smallY) {
        var coords = this.get_camera_coords(largeX, smallX, largeY, smallY);
        this.setPosition(coords.x, coords.y, coords.z);
        return coords;
    };

    this.get_camera_coords = function (largeX, smallX, largeY, smallY) {
        largeX = parseFloat(largeX);
        smallX = parseFloat(smallX);
        largeY = parseFloat(largeY);
        smallY = parseFloat(smallY);
        var output = {x: null, y: null, z: null};
        output.x = (largeX + smallX) / 2.0;
        output.y = (largeY + smallY) / 2.0;
        var xpos_z = ((largeX - smallX) / 2.0) / Math.tan(0.5);
        var ypos_z = ((largeY - smallY) / 2.0) / Math.tan(0.5);
        if (xpos_z > ypos_z) {
            output.z = xpos_z;
        } else {
            output.z = ypos_z;
        }
        if(output.z < 30 && this.zoom.out) {
            output.z = 30;
        }
        return output
    };
    this.add_coord_range = function(x,y) {
        x = parseFloat(x);
        y = parseFloat(y);
        if (maxmin.first) {
            maxmin.x.max = x;
            maxmin.x.min = x;
            maxmin.y.max = y;
            maxmin.y.min = y;
            maxmin.first = false;
        }
        if (x > maxmin.x.max) {
            maxmin.x.max = x;
        } else if (x < maxmin.x.min) {
            maxmin.x.min = x;
        }
        if (y > maxmin.y.max) {
            maxmin.y.max = y;
        } else if (y < maxmin.y.min) {
            maxmin.y.min = y;
        }
        var coords = this.get_camera_coords(maxmin.x.max, maxmin.x.min, maxmin.y.max, maxmin.y.min);
        this.zoom.default.x = coords.x;
        this.zoom.default.y = coords.y;
        this.zoom.default.z = coords.z;
        this.zoom.destination.x = coords.x;
        this.zoom.destination.y = coords.y;
        this.zoom.destination.z = coords.z;
    };

    var camera = new THREE.PerspectiveCamera( 75, aspectRatio, 0.1, 1000 );
    camera.position.x = 0;
    camera.position.y = 0;
    camera.position.z = 30;
    this.zoom = {
        default: {x: camera.position.x, y: camera.position.y, z: camera.position.z},
        lastObject: null,
        destination: {x: camera.position.x, y: camera.position.y, z: camera.position.z},
        out: true
    };

};

init();