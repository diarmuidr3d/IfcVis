/**
 * A set of THREE.js Meshes for Ifc Elements.
 *
 * Author:  Diarmuid Ryan
 *          Adapt Centre,
 *          Trinity College Dublin
 */

var IfcTHREE = {};

IfcTHREE.squareGeom = function (vector3Array) {
    var geometry = new THREE.Geometry();
    for(var i =0; i < vector3Array.length; i++) {
        geometry.vertices.push(vector3Array[i]);
    }
    geometry.faces.push(new THREE.Face3(0, 1, 2));
    geometry.faces.push(new THREE.Face3(0, 2, 3));
    geometry.faces.push(new THREE.Face3(2, 1, 0));
    geometry.faces.push(new THREE.Face3(3, 2, 0));
    return geometry;
};

IfcTHREE.polygonGeom = function (vector2Array) {
    var shape = new THREE.Shape();
    shape.moveTo(vector2Array[0].x, vector2Array[0].y);
    for(var i = 1; i < vector2Array.length; i++) {
        shape.lineTo(vector2Array[i].x, vector2Array[i].y);
    }
    return new THREE.ShapeGeometry(shape);
};

IfcTHREE.IfcSpace = function(vector3Array, material) {
    THREE.Mesh.call( this, IfcTHREE.polygonGeom(vector3Array),  material);
    this.type = 'IfcSpace';
    var walls = [];
    //var coords = vector3Array;
    //this.createWall = function (height, thickness, side) {
    //    var first = coords[side];
    //    var second;
    //    if(side == coords.length) {
    //        second = coords[0];
    //    } else {
    //        second = coords[side + 1];
    //    }
    //    var length = Math.sqrt(
    //        Math.pow((second.x - first.x), 2) +
    //        Math.pow((second.y - first.y), 2),
    //        Math.pow((second.z - first.z), 2)
    //    );
    //};
    this.addWall = function (wallMesh) {
        return walls.push(wallMesh);
    };
    this.getWall = function (index) {
        return walls[index];
    }
};
IfcTHREE.IfcSpace.prototype = Object.create( THREE.Mesh.prototype );

IfcTHREE.IfcWall = function (vector3Array, material) {
    THREE.Mesh.call( this, IfcTHREE.squareGeom(vector3Array),  material);
    this.type = 'IfcWall';
    var openings = [];
    this.addOpening = function (openingMesh) {
        return openings.push(openingMesh);
    };
    this.getOpening = function (index) {
        return openings[index];
    };
};
IfcTHREE.IfcWall.prototype = Object.create( THREE.Mesh.prototype );

IfcTHREE.IfcOpening = Object.create(THREE.Mesh);

IfcTHREE.IfcOpening = function (containingWall, vector3Array, material) {
    THREE.Mesh.call( this, IfcTHREE.squareGeom(vector3Array),  material);
    this.type = 'IfcOpening';
    containingWall.addOpening(this);
};
IfcTHREE.IfcOpening.prototype = Object.create(THREE.Mesh.prototype);

IfcTHREE.IfcDoor = function (containingWall, vector3Array, material) {
    THREE.Mesh.call( this, IfcTHREE.squareGeom(vector3Array),  material);
    IfcTHREE.IfcDoor.type = 'IfcDoor';
    containingWall.addOpening(this);
};
IfcTHREE.IfcDoor.prototype = Object.create(IfcTHREE.IfcOpening.prototype);

IfcTHREE.IfcWindow = Object.create(IfcTHREE.IfcOpening);
IfcTHREE.IfcDoor.type = 'IfcWindow';
