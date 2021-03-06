/**
 * Author:  Diarmuid Ryan
 *          ADAPT Centre,
 *          Trinity College Dublin
 *
 * Last Modified:   25/08/15
 */

var graph = "http://localhost:8080/fuseki/rdf_stf/data/new";
//var graph = "http://kdeg-vm-46.cs.tcd.ie:3036/ds/IfcVis/";
var queryEnd = "http://localhost:8080/fuseki/rdf_stf/query";
//var queryEnd = "http://kdeg-vm-46.cs.tcd.ie:3036/ds/query";
var updateEnd = "http://localhost:8080/fuseki/rdf_stf/update";
//var updateEnd = "http://kdeg-vm-46.cs.tcd.ie:3036/ds/update";
var sparql = new SPARQL(queryEnd, updateEnd, graph);
sparql.addPrefix("PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> " +
    "PREFIX ifc: <http://www.buildingsmart-tech.org/ifcOWL#> " +
    "PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> " +
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
    room: {default: 0xa2a2a2, highlight: 0xb82e7c, edge: 0x000000},
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

    ROOM_DETAILS.setContainer(detailsName);

    SENSOR_DETAILS.setVariable('Type', SENSOR_DETAILS.param.uri + ' rdf:type ' + SENSOR_DETAILS.param.val);
    SENSOR_DETAILS.setVariable('Enumerable Type',
        ' {' + SENSOR_DETAILS.param.uri + ' ifc:PredefinedType_of_IfcSensor ' + SENSOR_DETAILS.param.val + ' }' +
        'UNION {' + SENSOR_DETAILS.param.uri + ' ifc:PredefinedType_of_IfcFlowMeter ' +SENSOR_DETAILS.param.val+ ' } ');
    SENSOR_DETAILS.setVariable('Cost', SENSOR_DETAILS.param.uri + ' ifc:HasAssignments ?rag . ' +
        '?rag ifc:RelatingGroup ?asset . ?asset ifc:currentValue_of_IfcAsset ' +SENSOR_DETAILS.param.val);
    SENSOR_DETAILS.setVariable('Coordinates', SENSOR_DETAILS.param.uri + ' ifc:ObjectPlacement ?placement . ' +
        '?placement ifc:RelativePlacement ?relPlace . ' +
        '?relPlace ifc:Location ?pointList . ' +
        '?pointList ifc:Coordinates ?xcoord . ' +
        '?xcoord ifc:hasListContent/ifc:has_double ?x . ' +
        '?xcoord ifc:hasNext ?ycoord . ' +
        '?ycoord ifc:hasListContent/ifc:has_double ?y . ' +
        'BIND (fn:concat(?x, ", ", ?y) AS '+SENSOR_DETAILS.param.val+')');

    fullscreenOn = true;

    getUriToDisplay();
}

function getUriToDisplay (notUrl) {
    document.getElementById(detailsName).innerHTML = '<form role="form" id="getNs"> ' +
        '<div class="form-group"> ' +
        '<label for="name">Enter NameSpace:</label> ' +
        '<input type="text" class="form-control" id="name"> ' +
        '<button type="submit" class="btn btn-default" onClick=newProject("getNs"); >Load</button></form>';
    if(notUrl) {
        document.getElementById(detailsName).innerHTML = '<div class="alert alert-info"> ' +
        '<a href="#" class="close" data-dismiss="alert" aria-label="close">&times;</a>' +
        '<strong>Please enter a URL</strong> The value you entered did not appear to be a URL!</div>' +
        document.getElementById(detailsName).innerHTML;
    }
}

function newProject(id) {
    DEST_URI = document.getElementById(id).elements[0].value;
    if(null == DEST_URI.match(/^https?:\/\/([\da-z\.-]+)\.([a-z]{2,6})([\/\w\.-]+)[\/#]?$/)) {
        getUriToDisplay(true);
    } else {
        document.getElementById(detailsName).innerHTML = "Loading...";
        myCam = new CAMERA(width / height);
        scene = new THREE.Scene();
        sensors_dict = {};
        objects = [];
        walls = [];
        MODIFY_SENSOR.clear(null);
        var grid = new THREE.GridHelper(100, 1);
        grid.rotation.x = Math.PI / 2;
        scene.add(grid);
        animate_sensors();
        animate_rooms();
        document.getElementById(detailsName).innerHTML = "";
        render();
    }
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
        addingRoom = false;
        scene.remove(addedObj);
        scene.add(drawBox(clickedCoords, null, null, new THREE.MeshBasicMaterial({color: 0xff0000})));
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
        addedObj = drawBox(clickedCoords, null, null, new THREE.MeshBasicMaterial({color: 0xff0000}));
        scene.add(addedObj);
    }
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
            addedObj = drawBox(clickedCoords, point, null, new THREE.MeshBasicMaterial({color: 0xff0000}));
            scene.add(addedObj);
        }
    }
}

function animate_sensors() {
    var query = 'SELECT ?sensor ?x ?y FROM <' + sparql.getGraph() + '> WHERE { ' +
        '{ ?sensor rdf:type ifc:IfcSensor } UNION { ?sensor rdf:type ifc:IfcFlowMeter } . ' +
        '?sensor ifc:ObjectPlacement/ifc:RelativePlacement/ifc:Location/ifc:Coordinates ?xcoord . ' +
        '?xcoord ifc:hasListContent/ifc:has_double ?x . ' +
        '?xcoord ifc:hasNext/ifc:hasListContent/ifc:has_double ?y . ' +
        'FILTER(STRSTARTS(STR(?sensor), "' + DEST_URI + '")) . ' +
        '} ';
    var results = sparql.simpleQuery(query);
    for(var i = 0; i < results.length; i++) {
        var xcoord = parseFloat(results[i].x.value);
        var ycoord = parseFloat(results[i].y.value);
        addSensor(results[i].sensor.value, xcoord, ycoord);
        myCam.add_coord_range(xcoord, ycoord, 0);
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

function animate_rooms() {
    var query = 'PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>'+
        'PREFIX ifc: <http://www.buildingsmart-tech.org/ifcOWL#>'+
        'SELECT ?room ?placement ?ptlist FROM <'+sparql.getGraph()+'> '+
        'WHERE { ?room rdf:type ifc:IfcSpace . ' +
        '?room ifc:Representation/ifc:Representations/ifc:hasListContent/ifc:Items ?item . '+
        '{ ' +
        '?item ifc:Bounds/ifc:Bound/ifc:Polygon ?ptlist . ' +
        '} UNION { ' +
        '?item ifc:SweptArea/ifc:OuterCurve/ifc:Points ?ptlist . ' +
        '} ' +
        'OPTIONAL {?room ifc:ObjectPlacement ?placement } . ' +
        'FILTER(STRSTARTS(STR(?room), "' + DEST_URI + '")) }';
    var results = sparql.simpleQuery(query);
    for(var i = 0; i < results.length; i++) {
        var room = new THREE.Shape();
        var thisRow = results[i];
        var roomName = thisRow.room.value;
        //if(roomName == "http://linkedbuildingdata.net/ifc/instances20150430_124509#IfcSpace_1119") {
            var offsetCoords = null;
            if ("placement" in thisRow) {
                offsetCoords = getCumulativePlacement(thisRow["placement"].value);
            }
            if ("ptlist" in thisRow) {
                var coord_results = getCoordinatesFromList(thisRow["ptlist"].value);
                if (coord_results.length > 0) {
                    addRoom(roomName, coord_results, offsetCoords);
                }
            }
            addWallsForRoom(roomName);
        //}
    }
}

function getCumulativePlacement (localPlacementUri) {
    var query = 'SELECT ?x ?y ?z FROM <' + sparql.getGraph() + '> WHERE { ' +
        '<' + localPlacementUri + '> ifc:PlacementRelTo*/ifc:RelativePlacement ?axisPlace . ' +
        '?axisPlace ifc:Location_of_IfcPlacement/ifc:Coordinates_of_IfcCartesianPoint ?xcoord . ' +
        '?xcoord ifc:hasListContent/ifc:has_double ?x . ' +
        '{ ?xcoord ifc:hasNext ?ycoord } UNION { ?xcoord ifc:isFollowedBy ?ycoord } . ' +
        '?ycoord ifc:hasListContent/ifc:has_double ?y . ' +
        '{ ?ycoord ifc:hasNext ?zcoord } UNION { ?ycoord ifc:isFollowedBy ?zcoord }. ' +
        '?zcoord ifc:hasListContent/ifc:has_double ?z . ' +
        '}';
    var coord_results = sparql.simpleQuery(query);
    var coords = coord_results[0];
    var coordinates = {
        x: parseFloat(coords.x.value),
        y: parseFloat(coords.y.value),
        z: parseFloat(coords.z.value)
    };
    for(var i = 1; i < coord_results.length; i++) {
        coords = coord_results[i];
        coordinates.x += parseFloat(coords.x.value);
        coordinates.y += parseFloat(coords.y.value);
        coordinates.z += parseFloat(coords.z.value);
    }
    return coordinates;
}

function getCoordinatesFromList (uri, offset) {
    if(offset == null) {
        offset = {x: 0, y: 0, z: 0};
    }
    var coordinates = [];
    var query = 'SELECT ?x ?y ?z FROM <' + sparql.getGraph() + '> ' +
        'WHERE { ' +
        '<' + uri + '> (ifc:hasNext|ifc:isFollowedBy)*/ifc:hasListContent/' +
        '(ifc:Coordinates_of_IfcCartesianPoint|ifc:Coordinates) ?loop . ' +
        '?loop ifc:hasListContent/ifc:has_double ?x . ' +
        '?loop ifc:hasNext|ifc:isFollowedBy ?loop2 . ' +
        '?loop2 ifc:hasListContent/ifc:has_double ?y . ' +
        'OPTIONAL { ' +
            '?loop2 (ifc:hasNext|ifc:isFollowedBy)/ifc:hasListContent/ifc:has_double ?z . ' +
        '} ' +
        '}';
    var coords = sparql.simpleQuery(query);
    for (var i = 0; i < coords.length; i++) {
        var thisRow = coords[i];
        if("x" in thisRow) {
            if("z" in thisRow) {
                coordinates.push([
                    parseFloat(thisRow.x.value) + offset.x,
                    parseFloat(thisRow.y.value) + offset.y,
                    parseFloat(thisRow.z.value) + offset.z
                ]);
            } else {
                coordinates.push([
                    parseFloat(thisRow.x.value) + offset.x,
                    parseFloat(thisRow.y.value) + offset.y,
                    offset.z
                ]);
            }
        }
    }
    return coordinates;
}

var wallMaterial = new THREE.MeshBasicMaterial({color: 0x00ff00, transparent: true, opacity: 0.2});
var openingMaterial = new THREE.MeshBasicMaterial({color: 0x0000ff, transparent: true, opacity: 0.2});

function addWallsForRoom (room_uri) {
    var query = 'SELECT ?section ?wall ?place FROM <'+sparql.getGraph()+'> WHERE { ' +
        '{ ' +
            '?bound ifc:RelatingSpace <' + room_uri +'> . ' +
            '?bound rdf:type ifc:IfcRelSpaceBoundary2ndLevel . ' +
            '?bound ifc:InnerBoundaries ?section . ' +
            '?section ifc:RelatedBuildingElement ?wall . ' +
            '?wall rdf:type ifc:IfcWallStandardCase . ' +
            'OPTIONAL { ?wall ifc:ObjectPlacement ?place } . ' +
        '} UNION { ' +
            '?section ifc:RelatingSpace <' + room_uri +'> . ' +
            '?section ifc:RelatedBuildingElement_of_IfcRelSpaceBoundary ?wall . ' +
            '?wall rdf:type ifc:IfcWallStandardCase . ' +
            'OPTIONAL { ?wall ifc:ObjectPlacement ?place } . ' +
        '}' +
        '}';
    var boundary_results = sparql.simpleQuery(query);
    var sectionUri, offset = null, thisRow;
    for (var i = 0; i < boundary_results.length; i++) {
        thisRow = boundary_results[i];
        sectionUri = thisRow["section"].value;
        query = 'SELECT ?coordsUri ?depth FROM <'+sparql.getGraph()+'> WHERE { ' +
            '<'+sectionUri+'> (ifc:ConnectionGeometry|ifc:ConnectionGeometry_of_IfcRelSpaceBoundary)/' +
            'ifc:SurfaceOnRelatingElement ?cbp . ' +
            '?cbp ifc:OuterBoundary|ifc:OuterBoundary_of_IfcCurveBoundedPlane|(ifc:SweptCurve/ifc:Curve) ?line . ' +
            'OPTIONAL { ?cbp ifc:Depth_of_IfcSurfaceOfLinearExtrusion/ifc:has_double ?depth } . ' +
            '?line ifc:Points ?coordsUri . ' +
            '}';
        var coords = sparql.simpleQuery(query);
        if(coords.length > 0) {
            if("place" in thisRow) {
                offset = getCumulativePlacement(thisRow["place"].value);
            }
            var coordinates = [];
            var coord = coords[0];
            if ("coordsUri" in coord) {
                coordinates = getCoordinatesFromList(coord["coordsUri"].value, offset);
            }
            if("depth" in coord) {
                coordinates.push([coordinates[1][0], coordinates[1][1], parseFloat(coord.depth.value) + offset.z]);
                coordinates.push([coordinates[0][0], coordinates[0][1], parseFloat(coord.depth.value) + offset.z]);
            }
            if (coordinates.length > 2) {
                var wallMesh = drawUprightBox(coordinates, null, wallMaterial);
                wallMesh.uri = thisRow["wall"].value;
                wallMesh.renderOrder = 1;
                scene.add(wallMesh);
                walls.push(wallMesh);
            }
        }
        addOpening(boundary_results[i]["wall"].value);
    }
}

function addOpening (wallUri) {
    this.addDoor = function (doorUri) {
        var query = 'SELECT ?x ?y ?z FROM <' + sparql.getGraph() + '> WHERE { ' +
            '<'+doorUri+'> ifc:Representation/ifc:hasListContent/ifc:Items/ifc:Points/ifc:hasNext*/' +
            'ifc:hasListContent/ifc:Coordinates ?lengthListx . ' +
            '?lengthListx ifc:hasListContent/ifc:has_double ?x . ' +
            '?lengthListx ifc:hasNext ?lengthListy . ' +
            '?lengthListy ifc:hasListContent/ifc:has_double ?y . ' +
            '?lengthListy ifc:hasNext/ifc:hasListContent/ifc:has_double ?z . ' +
            '}';
        var results = sparql.simpleQuery(query);
        if(results.length > 0) {
            var coords = [];
            for (var j = 0; j < results.length; j++) {
                coords.push([results[j]["x"].value, results[j]["y"].value, results[j]["z"].value]);
                var point = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1),
                    new THREE.MeshBasicMaterial({color: 0xff0000}));
                point.position.x = results[j]["x"].value;
                point.position.y = results[j]["y"].value;
                point.position.z = results[j]["z"].value;
                scene.add(point);
            }
            var opening = drawUprightBox(coords, null, openingMaterial);
            scene.add(opening);
        }
    };

    var query = 'SELECT ?windoor ?type FROM <' + sparql.getGraph() + '> WHERE { ' +
        '<'+wallUri+'> ifc:HasOpenings/ifc:RelatedOpeningElement/ifc:HasFillings/ifc:RelatedBuildingElement ?windoor . ' +
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

function drawUprightBox(coords, offset, material) {
    if(offset == null) {
        offset = {x:0, y:0, z:0};
    }
    var geometry = new THREE.Geometry();
    var x, y,z;
    for(var i =0; i < coords.length; i++) {
        x = coords[i][0] + offset.x;
        y = coords[i][1] + offset.y;
        z = coords[i][2] + offset.z;
        //myCam.add_coord_range(x, y, z);
        geometry.vertices.push(new THREE.Vector3( x, y, z ));
    }
    geometry.faces.push(new THREE.Face3(0, 1, 2));
    geometry.faces.push(new THREE.Face3(0, 2, 3));
    geometry.faces.push(new THREE.Face3(2, 1, 0));
    geometry.faces.push(new THREE.Face3(3, 2, 0));
    return new THREE.Mesh(geometry, material);
}

function drawBox(coords, extraCoord, offset, material) {
    if(offset == null) {
        offset = {x:0, y:0, z:0};
    }
    var box = new THREE.Shape();
    var x = coords[0][0] + offset.x;
    var y = coords[0][1] + offset.y;
    box.moveTo(x, y);
    myCam.add_coord_range(x, y, offset.z);
    for(var i = 1; i < coords.length; i++) {
        x = coords[i][0] + offset.x;
        y = coords[i][1] + offset.y;
        box.lineTo(x, y);
        myCam.add_coord_range(x,y, offset.z);
    }
    if(extraCoord != null) {
        box.lineTo(extraCoord[0] + offset.x, extraCoord[1] + offset.y);
    }
    var geom = new THREE.ShapeGeometry(box);
    var mesh = new THREE.Mesh( geom, material );
    mesh.position.z = offset.z;
    return mesh;
}

function addRoom(uri, coordinates, roomOffset) {
    var roomMesh = drawBox(coordinates, null, roomOffset, new THREE.MeshBasicMaterial({color: defaultColours.room.default, transparent: true, opacity: 0.8}));
    roomMesh.uri = uri;
    scene.add(roomMesh);
    roomMesh.myType = "room";
    objects.push(roomMesh);
    var edge = new THREE.EdgesHelper( roomMesh, defaultColours.room.edge );
    edge.material.linewidth = 2;
    scene.add( edge );
}

var CAMERA = function (aspectRatio) {

    var maxmin = {x: {max: null, min: null}, y: {max: null, min: null}, z: {max: null, min: null}, first:true};

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
        var xpos_z = (( (largeX - smallX) / Math.tan(camera.fov / (2 * (180 / Math.PI)))) / 2.0) + maxmin.z.max;
        var ypos_z = (( (largeY - smallY) / Math.tan(camera.fov / (2 * (180 / Math.PI)))) / 2.0) + maxmin.z.max;
        if (xpos_z > ypos_z) {
            output.z = xpos_z + (0.1 * xpos_z);
        } else {
            output.z = ypos_z+ (0.1 * ypos_z);
        }
        if(output.z < 30 && this.zoom.out) {
            output.z = 30;
        }
        return output
    };
    this.add_coord_range = function(x,y,z) {
        x = parseFloat(x);
        y = parseFloat(y);
        z = parseFloat(z);
        if (maxmin.first) {
            maxmin.x.max = x;
            maxmin.x.min = x;
            maxmin.y.max = y;
            maxmin.y.min = y;
            maxmin.z.max = z;
            maxmin.z.min = z;
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
        if (z > maxmin.z.max) {
            maxmin.z.max = z;
        } else if (z < maxmin.z.min) {
            maxmin.z.min = z;
        }
        var coords = this.get_camera_coords(maxmin.x.max, maxmin.x.min, maxmin.y.max, maxmin.y.min);
        this.zoom.default.x = coords.x;
        this.zoom.default.y = coords.y;
        this.zoom.default.z = coords.z;
        this.zoom.destination.x = coords.x;
        this.zoom.destination.y = coords.y;
        this.zoom.destination.z = coords.z;
    };

    var camera = new THREE.PerspectiveCamera( 75, aspectRatio, 0.1, 10000 );
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