/**
 * Author:  Diarmuid Ryan
 *          ADAPT Centre,
 *          Trinity College Dublin
 *
 * Last Modified:   21/08/15
 */


var SENSORS = function (controlButtons, sparqlAccessor) {

    var controls = controlButtons;
    var sparql = sparqlAccessor;

    this.MODIFY = function(containerForFormId) {
        var container = document.getElementById(containerForFormId);
        this.setContainer = function(id) {
            container = document.getElementById(id);
        };
        this.getContainer = function () {
            return container;
        };

        var selected = {current: "", last: ""};
        this.selectSensor = function(sensorUri) {
            selected.last = selected.current;
            selected.current = sensorUri;
            if(document.getElementById(selected.last) != null) {
                document.getElementById(selected.last).classList.remove("success");
            }
            if(selected.last in sensors_dict) {
                sensors_dict[selected.last].material.color.setHex(defaultColours.sensor.default);
            }
            if(document.getElementById(selected.current) != null) {
                document.getElementById(selected.current).classList.add("success");
            }
            if(selected.current in sensors_dict) {
                sensors_dict[selected.current].material.color.setHex(defaultColours.sensor.highlight);
            }
        };

        this.getSelectedSensor = function() {
            return selected.current;
        };
        this.getLastSelectedSensor = function() {
            return selected.last;
        };

        var sensorTypes = {
            IfcSensor: ["CO2SENSOR", "CONDUCTANCESENSOR", "CONTACTSENSOR", "FIRESENSOR", "FLOWSENSOR", "FROSTSENSOR",
                "GASSENSOR", "HEATSENSOR", "HUMIDITYSENSOR", "IDENTIFIERSENSOR", "IONCONCENTRATIONSENSOR", "LEVELSENSOR",
                "LIGHTSENSOR", "MOISTURESENSOR", "MOVEMENTSESNOR", "NOTDEFINED", "PHSENSOR", "PRESSURESENSOR", "RADIATIONSENSOR",
                "RADIOACTIVITYSENSOR", "SMOKESENSOR", "SOUNDSENSOR", "TEMPERATURESENSOR", "USERDEFINED", "WINDSENSOR"
            ],
            IfcFlowMeter: ["ENERGYMETER", "GASMETER", "NOTDEFINED", "USERDEFINED", "WATERMETER"]
        };

        var formData = {name: "", uri: "", value: "", type: "", coords:{x:null,y:null}};

        this.displayMainForm = function (isEdit) {
            addingSensor = true;
            this.isError = function(isEdit) {
                var error = false;
                if(myCam.zoom.lastObject == null) {
                    container.innerHTML = '<div class="alert alert-warning fade in"> ' +
                        '<a href="#" class="close" data-dismiss="alert" aria-label="close">&times;</a> ' +
                        '<strong>Warning!</strong> Please select a room first! </div>' + detailsContainer.innerHTML;
                    error = true;
                }
                if (isEdit && selected.current == null) {
                    container.innerHTML = '<div class="alert alert-warning fade in"> ' +
                        '<a href="#" class="close" data-dismiss="alert" aria-label="close">&times;</a> ' +
                        '<strong>Warning!</strong> Please select a sensor first! </div>' + detailsContainer.innerHTML;
                    error = true;
                }
                return error;
            };

            if(!this.isError(isEdit)) {
                var nameBox, arg;
                if (isEdit) {
                    nameBox = "";
                    arg = selected.current;
                    container.innerHTML = selected.current;
                } else {
                    nameBox = '<div class="form-group"> ' +
                        '<label for="name">Sensor Name:</label> ' +
                        '<input type="text" class="form-control" id="name"> ' +
                        '</div> ';
                    arg = "FORM_DEFINED";
                }
                container.innerHTML = ' <form role="form" id="frm1"> ' +
                    nameBox +
                    '<div class="form-group"> ' +
                    '<label for="name">Value:</label> ' +
                    '<input type="text" class="form-control" id="value"> ' +
                    '</div> ' +
                    '<div class="form-group"> ' +
                    '<label class="radio inline control-label">Sensor Type:</label> ' +
                    '<label class="radio-inline"><input type="radio" name="optradio">IfcSensor</label> ' +
                    '<label class="radio-inline"><input type="radio" name="optradio">IfcFlowMeter</label> ' +
                    '</div> ' +
                    '<div class="form-group">' +
                    '<label class="control-label" for="coords">Coords:</label>' +
                    '<p class="form-control-static" id="' + putClickedCoords + '">Click a point on the diagram to place your sensor</p>' +
                    '</div>' +
                    '<button type="submit" class="btn btn-default" onClick=MODIFY_SENSOR.addMainFormData("' + arg + '"); >Add</button> ' +
                    '</form>';
            }
        };

        this.addMainFormData = function (sensorName) {
            var form = document.getElementById("frm1");
            formData.coords.x = clickedCoordsForSensor[clickedCoordsForSensor.length - 1][0];
            formData.coords.y = clickedCoordsForSensor[clickedCoordsForSensor.length - 1][1];
            clickedCoordsForSensor = [];
            var i =0;
            if(sensorName == "FORM_DEFINED") {
                formData.name = form.elements[i].value;
                formData.uri = DEST_URI + formData.name;
                i++;
            } else {
                formData.uri = sensorName;
                var query = "SELECT ?name " +
                    "FROM <" + sparql.getGraph() + "> " +
                    "WHERE { " +
                    "<" + formData.uri + "> rdfs:label ?name" +
                    "}";
                var result = sparql.runQuery(query);
                formData.name = result.results.bindings[0].name.value;
            }
            formData.value = parseInt(form.elements[i].value);
            console.log(formData.value);
            i++;
            if(form.elements[i].checked == true) {
                formData.type = form.elements[i].nextSibling.data;
            } else {
                formData.type = form.elements[i+1].nextSibling.data;
            }
            this.addTypeForm();
        };

        this.addTypeForm = function() {
            var outString = ' <form role="form" id="typeForm"> <div class="form-group"> \
        <label class="radio inline control-label">Sensor Type:</label> ';

            for(var element = 0; element < sensorTypes[formData.type].length; element++) {
                outString += '<label class="radio-inline"><input type="radio" name="optradio">' +
                    sensorTypes[formData.type][element] + '</label> ';
            }
            outString += '</div> <button type="submit" class="btn btn-default" onClick=MODIFY_SENSOR.addTypeFormData("'+
                formData.uri + '"); >Add</button> </form>';
            container.innerHTML = outString;
        };

        this.addTypeFormData = function (sensorUri) {
            this.checkIfSensorHasAssetSetup = function(sensorUri) {
                var query = 'SELECT ?assetVal ' +
                    'FROM <' + sparql.getGraph() + '> ' +
                    'WHERE { ' +
                    '<' + sensorUri + '> ifc:HasAssignments ?rag . ' +
                    '?rag ifc:RelatingGroup ?asset . ' +
                    '?asset ifc:currentValue_of_IfcAsset ?assetVal ' +
                    '}';
                var result = sparql.simpleQuery(query);
                return result.length != 0;
            };
            this.createSensorAsset = function (sensorUri) {
                var query = 'WITH <' + sparql.getGraph() + '> \
        DELETE {} \
        INSERT { \
            <' + sensorUri + '_asset_assign> rdf:type ifc:IfcRelAssignsToGroup . \
            <' + sensorUri + '> ifc:HasAssignments <' + sensorUri + '_asset_assign> . \
            <' + sensorUri + '_asset> rdf:type ifc:IfcAsset . \
            <' + sensorUri + '_asset_assign> ifc:RelatingGroup <' + sensorUri + '_asset> . \
            <' + sensorUri + '_asset> ifc:currentValue_of_IfcAsset 0 .  \
        } \
        WHERE {} \
        ';
                console.log(sensorUri + " doesn't already have asset relations, adding them.");
                sparql.runUpdate(query);
            };
            this.checkIfSensorHasCoordSetup = function(sensorUri) {
                var query = 'SELECT ?point ' +
                    'FROM <' + sparql.getGraph() + '> ' +
                    'WHERE { ' +
                    '<' + sensorUri + '> cart:hasPlacement ?point ' +
                    '} ';
                var result = sparql.simpleQuery(query);
                return result.length != 0;
            };
            this.createSensorCoord = function (sensorUri) {
                var query = 'WITH <' + sparql.getGraph() + '> \
        DELETE {} \
        INSERT { \
            <' + sensorUri + '_point> rdf:type cart:Point . \
            <' + sensorUri + '> cart:hasPlacement <' + sensorUri + '_point> . \
            <' + sensorUri + '_point> cart:xcoord "" . \
            <' + sensorUri + '_point> cart:ycoord "" . \
        } \
        WHERE {} \
        ';
                console.log(sensorUri + " doesn't already have coordinate relations, adding them.");
                sparql.runUpdate(query);
            };

            var frm = document.getElementById("typeForm");
            var typeEnum;
            for(var i = 0; i < frm.elements.length; i++) {
                if(frm.elements[i].checked == true) {
                    typeEnum = frm.elements[i].nextSibling.data;
                }
            }
            if(!this.checkIfSensorHasAssetSetup(sensorUri)) {
                this.createSensorAsset(sensorUri);
            }
            if(!this.checkIfSensorHasCoordSetup(sensorUri)) {
                this.createSensorCoord(sensorUri);
            }
            var query = 'WITH <' + sparql.getGraph() + '> \
        DELETE { \
            <' + sensorUri + '> rdf:type ?oldType . \
            <' + sensorUri + '> ifc:PredefinedType_of_IfcSensor ?enumTypeA . \
            <' + sensorUri + '> ifc:PredefinedType_of_IfcFlowMeter ?enumTypeB . \
            ?asset ifc:currentValue_of_IfcAsset ?assetVal . \
            <' + sensorUri + '> rdfs:label ?oldLabel . \
            ?placement cart:xcoord ?x . \
            ?placement cart:ycoord ?y . \
        } \
        INSERT { \
            <' + sensorUri + '> rdf:type ifc:' + formData.type + ' . \
            <' + sensorUri + '> ifc:PredefinedType_of_' + formData.type + " ifc:" + typeEnum + ' . \
            <' + sensorUri + '> rdfs:label "' + formData.name + '" . \
            ?asset ifc:currentValue_of_IfcAsset ' + formData.value + ' . \
            ?container ifc:RelatedElements_of_IfcRelContainedInSpatialStructure <' + sensorUri + '> . \
            ?placement cart:xcoord ' + formData.coords.x + ' . \
            ?placement cart:ycoord ' + formData.coords.y + ' . \
        } \
        WHERE { \
            OPTIONAL { <' + sensorUri + '> cart:hasPlacement ?placement . \
                ?placement cart:xcoord ?x . \
                ?placement cart:ycoord ?y \
            } . \
            OPTIONAL { <' + sensorUri + '> rdf:type ?oldType } . \
            OPTIONAL { <' + sensorUri + '> ifc:PredefinedType_of_IfcSensor ?enumTypeA } . \
            OPTIONAL { <' + sensorUri + '> ifc:PredefinedType_of_IfcFlowMeter ?enumTypeB } . \
            OPTIONAL { <' + sensorUri + '> ifc:HasAssignments ?rag . \
                ?rag ifc:RelatingGroup ?asset . \
                ?asset ifc:currentValue_of_IfcAsset ?assetVal \
            } . \
            ?container ifc:RelatingStructure_of_IfcRelContainedInSpatialStructure <' + myCam.zoom.lastObject.uri + '> . \
        }';
            sparql.runUpdate(query);
            scene.remove(sensors_dict[sensorUri]);
            addSensor(sensorUri, formData.coords.x, formData.coords.y);
            this.clear(sensorUri);
        };

        this.relocateSensor = function (uri) {
            var query = "WITH <" + sparql.getGraph() + "> " +
                "DELETE { ?containedInOld ifc:RelatedElements_of_IfcRelContainedInSpatialStructure <" + selected.current + "> } " +
                "INSERT { ?containedInNew ifc:RelatedElements_of_IfcRelContainedInSpatialStructure <" + selected.current + "> } " +
                "WHERE { ?containedInNew ifc:RelatingStructure_of_IfcRelContainedInSpatialStructure <" + uri + "> . " +
                " ?containedInOld ifc:RelatedElements_of_IfcRelContainedInSpatialStructure <" + selected.current + "> " +
                " } ";
            sparql.runUpdate(query);
            ROOM_DETAILS.getSensors(myCam.zoom.lastObject.uri);
        };

        this.clear = function (sensorUriToDisplay) {
            addingSensor = false;
            ROOM_DETAILS.getSensors(myCam.zoom.lastObject.uri);
            this.selectSensor(sensorUriToDisplay);
            document.getElementById(sensorUriToDisplay).classList.add("success");
            SENSOR_DETAILS.display(sensorUriToDisplay);
        };
    };

    this.DETAILS = function(containerId) {
        var variables = [];
        this.param = {uri: '@SENSOR_URI@', val: '@SENSOR_RESULT@'};

        var container = document.getElementById(containerId);

        this.setVariable = function (label, query) {
            variables.push({label: label, query: query});
        };

        this.setContainer = function (container) {
            container = document.getElementById(container);
        };

        this.display = function(sensorUri) {
            this.addWell = function (label, value) {
                return '<div class="col-md-3">' +
                    '<div class="well">' +
                    '<h3>' + label + '</h3><hr>' + value +
                    '</div></div>';
            };
            this.setupQuery = function (query, sensorUri) {
                var string = query;
                while(string.indexOf(this.param.uri) > -1 ||
                string.indexOf(this.param.val) > -1) {
                    string = string.replace(this.param.uri,
                        '<' + sensorUri + '>').replace(this.param.val, '?value');
                }
                return ' SELECT ?value FROM <' + sparql.getGraph() + '> WHERE { ' + string + ' }';
            };

            container.innerHTML = "";
            for(var i in variables) {
                var pair = variables[i];
                var results = sparql.runQuery(this.setupQuery(pair.query, sensorUri),1);
                var value = "";
                if(results.results.bindings.length != 0) {
                    value = results.results.bindings[0].value.value;
                }
                container.innerHTML += this.addWell(pair.label, value);
            }
        };

        this.clear = function () {
            container.innerHTML = "";
            controls.relocate.disable();
            controls.edit.disable();
        };
    };
};

var CONTROLS = {};

var BUTTON = function (id) {
    var buttonId = id;
    var element = document.getElementById(id);
    var dropdown = false;
    var dropdownContent;

    this.disable = function() {
        element.classList.add("disabled");
    };
    this.enable = function() {
        element.classList.remove("disabled");
    };
    this.setDropdown = function(contentId) {
        dropdown = true;
        dropdownContent = document.getElementById(contentId);
    };
    this.addContent = function (content) {
        if(!dropdown) {
            console.log("A non dropdown (" + buttonId + ") is trying to add Content!");
        } else if (dropdownContent != null) {
            dropdownContent.innerHTML += content;
        }
    };
    this.clearContent = function () {
        if(!dropdown) {
            console.log("A non dropdown (" + buttonId + ") is trying to clear Content!");
        } else if (dropdownContent != null) {
            dropdownContent.innerHTML = "";
        }
    };
};

var ROOM_DETAILS = {};

ROOM_DETAILS.HEIGHT_OF_NEW_WALL = 2;

ROOM_DETAILS.container = "";
ROOM_DETAILS.setContainer = function(id) {
    ROOM_DETAILS.container = document.getElementById(id);
};

ROOM_DETAILS.selected = {current: "", last: ""};
ROOM_DETAILS.selectRoom = function (roomUri) {
    ROOM_DETAILS.selected.last = ROOM_DETAILS.selected.current;
    ROOM_DETAILS.selected.current = roomUri;
};

ROOM_DETAILS.getSensors = function (room_uri) {
    var sensorSelector = "";
    if (myCam.zoom.out == false) {
        var query = 'SELECT ?x ?name ?type ?enum ?val FROM <' + sparql.getGraph() + '> ' +
            'WHERE {    ?s ifc:RelatingStructure_of_IfcRelContainedInSpatialStructure <' + room_uri + '> . ' +
            '   ?s ifc:RelatedElements_of_IfcRelContainedInSpatialStructure ?x . ' +
            '{ ?x rdf:type ifc:IfcSensor } UNION { ?x rdf:type ifc:IfcFlowMeter } . ' +
            '   OPTIONAL { ?x rdfs:label ?name } . ' +
            '}';
        sensorSelector += '<table class="table table-hover">' +
            '<thead><tr><th>Sensor Names</th></tr></thead>' +
            '<tbody>';
        var results = sparql.simpleQuery(query);
        for (var i = 0; i < results.length; i++) {
            var element = results[i]["x"]["value"];
            if("name" in results[i]) {
                var name = results[i]["name"]["value"];
            }
            sensorSelector += '<tr id="' + element + '" class="clickable" ' +
                'onClick=ROOM_DETAILS.pickSensor("' + element + '"); ><td>' + name + '</td></tr>';
        }
        sensorSelector += '</tbody></table>';
    }
    ROOM_DETAILS.container.innerHTML = sensorSelector;
};

ROOM_DETAILS.pickSensor = function (uri) {
    SENSOR_DETAILS.display(uri);
    MODIFY_SENSOR.selectSensor(uri);
    CONTROLS.relocate.enable();
    CONTROLS.relocate.clearContent();
    var query = "SELECT ?allRooms " +
        "FROM <" + sparql.getGraph() + "> " +
        "WHERE { " +
        "   ?s ifc:RelatedElements_of_IfcRelContainedInSpatialStructure <" + uri + "> . " +
        "   ?s ifc:RelatingStructure_of_IfcRelContainedInSpatialStructure ?room . " +
        "   ?allRooms rdf:type ifc:IfcSpace . " +
        "   FILTER (?allRooms != ?room) " +
        "}";
    var result = sparql.runQuery(query);
    for(var i = 0; i < result.results.bindings.length; i++) {
        var roomUri = result.results.bindings[i].allRooms.value;
        CONTROLS.relocate.addContent('<li><a href="#"><div ' +
            'onmousedown=MODIFY_SENSOR.relocateSensor("' + roomUri + '"); >'+ roomUri + '</div></a></li>');
    }
    CONTROLS.edit.enable();
};

ROOM_DETAILS.addRoomForm = function (){
    addingRoom = true;
    ROOM_DETAILS.container.innerHTML =' <form role="form" id="newRoom"> ' +
        '<div class="form-group"> ' +
        '<label for="name">Room Name:</label> ' +
        '<input type="text" class="form-control" id="name"> ' +
        '</div><button type="submit" class="btn btn-default" onClick=ROOM_DETAILS.addRoom(); >' +
        'Add</button></form>';
};

ROOM_DETAILS.addRoom = function () {
    this.addFace = function (coord1, coord2) {
        coord1.push(0);
        coord2.push(0);
        var coord3 = [coord2[0], coord2[1], ROOM_DETAILS.HEIGHT_OF_NEW_WALL];
        var coord4 = [coord1[0], coord1[1], ROOM_DETAILS.HEIGHT_OF_NEW_WALL];
        var pointList1 = this.addCorner(coord1, 0);
        var pointList2 = this.addCorner(coord2, 1);
        var pointList3 = this.addCorner(coord3, 2);
        var pointList4 = this.addCorner(coord4, 3);
        query += '<' + pointList1 + '> ifc:hasNext <' + pointList2 + '> . ' +
            '<' + pointList2 + '> ifc:hasNext <' + pointList3 + '> . ' +
            '<' + pointList3 + '> ifc:hasNext <' + pointList4 + '> . ' +
            '<' + pointList4 + '> ifc:hasNext <' + pointList1 + '> . ';
    };
    this.addCorner = function (coord, counter) {
        var pointList = thisBoundary + "_points_" + counter;
        query += '<' + pointList + '> rdf:type ifc:IfcCartesianPoint_List . ' +
            '<' + thisLine + '> ifc:Points <' + pointList + '> . ';
        var point = thisBoundary + "_point_" + counter;
        query += '<' + point + '> rdf:type ifc:IfcCartesianPoint . ' +
            '<' + pointList + '> ifc:hasListContent <' + point + '> . ';
        var xcoord = point + "_x";
        this.createCoordList(coord[0], xcoord);
        var ycoord = point + "_y";
        this.createCoordList(coord[1], ycoord);
        var zcoord = point + "_z";
        this.createCoordList(coord[2], zcoord);
        query += '<' + point + '> ifc:Coordinates <' + xcoord + '> . ' +
            '<' + xcoord + '> ifc:hasNext <' + ycoord + '> . ' +
            '<' + ycoord + '> ifc:hasNext <' + zcoord + '> . ';
        return pointList;
    };
    this.createCoordList = function (coordVal, name) {
        query += '<' + name + '> rdf:type ifc:IfcLengthMeasure_List . ' +
            '<' + name + '> ifc:hasListContent "' + coordVal + '"^^ifc:IfcLengthMeasure . '
    };

    var form = document.getElementById("newRoom");
    var name = form.elements[0].value;
    var uri = DEST_URI + name;
    var point_list_uri = DEST_URI + "coords_of_" + name;
    var point_uri = DEST_URI + name + "_point_";
    var containerUri = DEST_URI + "contained_in_" + name;
    var boundaryUri = uri + "_boundary";
    if (clickedCoords.length > 2) {
        clickedCoords.push([clickedCoords[0][0], clickedCoords[0][1]]);
        var query = 'WITH <' + sparql.getGraph() + '> DELETE {} INSERT {' +
            '<'+uri+'> rdf:type ifc:IfcSpace . ' +
            '<'+uri+'> rdfs:label "'+name+'" . ' +
            '<'+point_list_uri+'> rdf:type cart:Point_List . ' +
            '<'+uri+'> cart:hasPlacement <'+point_list_uri+'> . ' +
            '<'+containerUri+'> rdf:type ifc:IfcRelContainedInSpatialStructure . ' +
            '<'+containerUri+'> ifc:RelatingStructure_of_IfcRelContainedInSpatialStructure <'+uri+'> . ' +
            '<'+boundaryUri+'> rdf:type ifc:IfcRelSpaceBoundary2ndLevel . ' +
            '<'+boundaryUri+'> ifc:RelatingSpace <'+uri+'> . ';
        for(var i = 0; i < clickedCoords.length; i++) {
            var thisPoint = point_uri + i;
            query += '<'+thisPoint+'> rdf:type cart:Point . ' +
                '<'+point_list_uri+'> cart:hasPoint <'+thisPoint+'> . ' +
                '<'+thisPoint+'> cart:xcoord '+ clickedCoords[i][0] + ' . ' +
                '<'+thisPoint+'> cart:ycoord '+ clickedCoords[i][1] + ' . ';
            if(i != clickedCoords.length - 1) {
                var thisWall = uri + "_wall_" + i;
                query += '<'+thisWall+'> rdf:type ifc:IfcWallStandardCase . ' +
                    '<'+containerUri+'> ifc:RelatedElements_of_IfcRelContainedInSpatialStructure <'+thisWall+'> . ';
                var thisBoundary = boundaryUri + "_" + i;
                query += '<'+thisBoundary+'> rdf:type ifc:IfcRelSpaceBoundary2ndLevel . ' +
                    '<'+thisBoundary+'> ifc:RelatedBuildingElement <'+thisWall+'> . ' +
                    '<'+boundaryUri+'> ifc:InnerBoundaries <'+thisBoundary+'> . ' +
                    '<'+thisBoundary+'> ifc:ParentBoundary <'+boundaryUri+'> . ';
                var connectionGeom = thisBoundary + "_csg";
                query += '<'+connectionGeom+'> rdf:type ifc:IfcConnectionSurfaceGeometry . ' +
                    '<'+thisBoundary+'> ifc:ConnectionGeometry <'+connectionGeom+'> . ';
                var thisPlane = thisBoundary + '_cbp';
                query += '<'+thisPlane+'> rdf:type ifc:IfcCurveBoundedPlane . ' +
                    '<'+connectionGeom+'> ifc:SurfaceOnRelatingElement <'+thisPlane+'> . ';
                var thisLine = thisBoundary + "_line";
                query += '<'+thisLine+'> rdf:type ifc:IfcPolyline . ' +
                    '<'+thisPlane+'> ifc:OuterBoundary <'+thisLine+'> . ';
                this.addFace(clickedCoords[i], clickedCoords[i+1]);
            }
        }
        query += " } WHERE {} ";
        sparql.runUpdate(query);
        addRoom(uri, clickedCoords);
        clickedCoords = [];
        clickedCoordsForSensor = [];
        scene.remove(addedObj);
        for(var j = 0; j < pointsForAddingRoom.length; j++) {
            scene.remove(pointsForAddingRoom[j]);
        }
        addingRoom = false;
        ROOM_DETAILS.getSensors(uri);
        addWallsForRoom(uri);
    } else {
        ROOM_DETAILS.container.innerHTML = '<div class="alert alert-info"> ' +
            '<a href="#" class="close" data-dismiss="alert" aria-label="close">&times;</a>' +
            '<strong>Please add coordinates.</strong> Click on the points on the diagram at which you would like ' +
            'the room corners, then press "Add" again. You must start and finish at the same point</div>' +
            ROOM_DETAILS.container.innerHTML;
    }
};

ROOM_DETAILS.addOpeningForm = function () {
    addingOpening = true;
    ROOM_DETAILS.container.innerHTML = ' <form role="form" id="newOpening"> ' +
        '<div class="form-group"> ' +
        '<label for="name">Opening Name:</label> ' +
        '<input type="text" class="form-control" id="name"> ' +
        '<div class="form-group"> ' +
        '<label class="radio inline control-label">Opening Type:</label> ' +
        '<label class="radio-inline"><input type="radio" name="optradio">Door</label> ' +
        '<label class="radio-inline"><input type="radio" name="optradio">Window</label> ' +
        '</div> ' +
        '</div><button type="submit" class="btn btn-default" onClick=ROOM_DETAILS.addOpeningTypeForm(); >Add</button></form>';
};

ROOM_DETAILS.openingFormData = {};

ROOM_DETAILS.doorTypes = [["Double Door - Double Swing", "DOUBLE_DOOR_DOUBLE_SWING"],
    ["Double Door - Double Swing Left", "DOUBLE_SWING_LEFT"],
    ["Double Door - Double Swing Right", "DOUBLE_SWING_RIGHT"],
    ["Double Door - Single Swing", "DOUBLE_DOOR_SINGLE_SWING"],
    ["Double Door - Single Swing Left", "DOUBLE_DOOR_SINGLE_SWING_OPPOSITE_LEFT"],
    ["Double Door - Single Swing Right", "DOUBLE_DOOR_SINGLE_SWING_OPPOSITE_Right"],
    ["Double Door - Folding", "DOUBLE_DOOR_FOLDING"],
    ["Double Door - Sliding", "DOUBLE_DOOR_SLIDING"],
    ["Folding - Left", "FOLDING_TO_LEFT"],
    ["Folding - Right", "FOLDING_TO_RIGHT"],
    ["Not Defined", "NOTDEFINED"],
    ["User Defined", "USERDEFINED"],
    ["Revolving", "REVOLVING"],
    ["Rolling Up", "ROLLINGUP"],
    ["Single Swing - Left", "SINGLE_SWING_LEFT"],
    ["Single Swing - Right", "SINGLE_SWING_RIGHT"],
    ["Sliding - Left", "SLIDING_TO_LEFT"],
    ["Sliding - Right", "SLIDING_TO_RIGHT"],
    ["Swing Fixed Left", "SWING_FIXED_LEFT"],
    ["Swing Fixed Right", "SWING_FIXED_RIGHT"]
];

ROOM_DETAILS.addOpeningTypeForm = function() {
    var elements = document.getElementById("newOpening").elements;
    ROOM_DETAILS.openingFormData["name"] = elements[0].value;
    if(elements[1].checked) {
        ROOM_DETAILS.openingFormData["type"] = "http://www.buildingsmart-tech.org/ifcOWL#IfcDoorStandardCase";
        var uri = ROOM_DETAILS.addOpening();
        var string = ' <form role="form" id="newOpeningType"> ' +
            '<div class="form-group"> ';
        for (var i = 0; i < ROOM_DETAILS.doorTypes.length; i++) {
            string += '<label class="radio-inline"><input type="radio" name="optradio">' +
                ROOM_DETAILS.doorTypes[i][0] + '</label> ';
        }
        ROOM_DETAILS.container.innerHTML = string + '</div>' +
            '<button type="submit" class="btn btn-default" onClick=ROOM_DETAILS.addOpeningType("' + uri +
            '"); >Add</button></form>';
    } else /*if (elements[2].checked)*/ {
        ROOM_DETAILS.openingFormData["type"] = "http://www.buildingsmart-tech.org/ifcOWL#IfcWindowStandardCase";
        ROOM_DETAILS.addOpening();
    }
};

ROOM_DETAILS.addOpening = function () {
    var voidUri = clickedWall + "_void";
    var openUri = clickedWall + '_opening';
    var fillUri = clickedWall + '_filling';
    var uri = DEST_URI + ROOM_DETAILS.openingFormData["name"];
    var repreUri = uri + '_representation';
    var repreList = repreUri + '_list';
    var shapeUri = repreList + '_shape';
    var lineUri = uri + '_outline';
    var pointListUri = lineUri + '_point_list';
    var thisPointListUri = pointListUri + 0;
    var query =
        'WITH <'+sparql.getGraph()+'> DELETE {} INSERT { ' +
        '<' + voidUri + '> rdf:type ifc:IfcRelVoidsElement . ' +
        '<'+clickedWall+'> ifc:HasOpenings <' + voidUri + '> . ' +
        '<'+ openUri + '> rdf:type ifc:IfcOpeningStandardCase . ' +
        '<' + voidUri + '> ifc:RelatedOpeningElement <'+ openUri + '> . ' +
        '<'+ fillUri + '> rdf:type ifc:IfcRelFillsElement . ' +
        '<'+ openUri + '> ifc:HasFillings <'+ fillUri + '> . ' +
        '<' + uri + '> rdf:type <' + ROOM_DETAILS.openingFormData["type"] + '> . ' +
        '<'+ fillUri + '> ifc:RelatedBuildingElement <' + uri + '> . ' +
        '?containedInRoom ifc:RelatedElements_of_IfcRelContainedInSpatialStructure <' + uri + '> . ' +
        '<'+repreUri+'> rdf:type ifc:IfcProductDefinitionShape . ' +
        '<'+uri+'> ifc:Representation <'+repreUri+'> . ' +
        '<'+repreList+'> rdf:type ifc:IfcRepresentation_List . ' +
        '<'+repreUri+'> ifc:Representations <'+repreList+'> . ' +
        '<'+shapeUri+'> rdf:type ifc:IfcShapeRepresentation . ' +
        '<'+repreUri+'> ifc:hasListContent <'+shapeUri+'> . ' +
        '<'+lineUri+'> rdf:type ifc:IfcPolyline . ' +
        '<'+shapeUri+'> ifc:Items <'+lineUri+'> . ' +
        '<'+lineUri+'> ifc:Points <'+thisPointListUri+'> . ';
    for (var i = 0; i < clickedCoordsForWall.length; i++) {
        thisPointListUri = pointListUri + i;
        var next = parseInt(i) + 1;
        var nextPointListUri = pointListUri + next;
        var xcoordsUri = thisPointListUri + 'x';
        var ycoordsUri = thisPointListUri + 'y';
        var zcoordsUri = thisPointListUri + 'z';
        var pointUri = thisPointListUri + '_point';
        var coord = clickedCoordsForWall[i];
        query += '<'+thisPointListUri+'> ifc:hasListContent <'+pointUri+'> . ' +
            '<'+pointUri+'> ifc:Coordinates <'+xcoordsUri+'> . ' +
            '<'+xcoordsUri+'> ifc:hasListContent "' + coord[0] + '"^^ifc:IfcLengthMeasure . ' +
            '<'+xcoordsUri+'> ifc:hasNext <'+ycoordsUri+'> . ' +
            '<'+ycoordsUri+'> ifc:hasListContent "' + coord[1] + '"^^ifc:IfcLengthMeasure . ';
        if(coord.length > 2) {
            query += '<' + ycoordsUri + '> ifc:hasNext <' + zcoordsUri + '> . ' +
                '<' + zcoordsUri + '> ifc:hasListContent "' + coord[2] + '"^^ifc:IfcLengthMeasure . ';
        }
        if(i != clickedCoordsForWall.length - 1) {
            query += '<'+thisPointListUri+'> ifc:hasNext <'+nextPointListUri+'> . '
        }
    }
    query += '} WHERE { ' +
        '?containedInRoom ifc:RelatingStructure_of_IfcRelContainedInSpatialStructure <' + ROOM_DETAILS.selected.current + '> .' +
        '} ';
    sparql.runUpdate(query);
    addOpening(clickedWall);
    clickedCoordsForWall = [];
    clickedCoords = [];
    clickedCoordsForSensor = [];
    addingOpening = false;
    ROOM_DETAILS.getSensors(ROOM_DETAILS.selected.current);
    return uri;
};

ROOM_DETAILS.addOpeningType = function (openingUri) {
    var elements = document.getElementById("newOpeningType").elements;
    var i = 0;
    while (!elements[i].checked) {
        i++;
    }
    var type = ROOM_DETAILS.doorTypes[i][1];
    var query =
        'WITH <' + sparql.getGraph() + '> DELETE {} INSERT { ' +
        '<' + openingUri + '> ifc:OperationType ifc:' + type +
        ' } WHERE {}';
    sparql.runUpdate(query);
    ROOM_DETAILS.getSensors(ROOM_DETAILS.selected.current);
};