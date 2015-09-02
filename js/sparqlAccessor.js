// * Version: 0.2
// *
// * Date: 18.02.2013
// *
// * Author: Kris McGlinn
// *
// * Modified by:   Diarmuid Ryan
// *
// * Last Modified: 21/08/15
// *
// * Copyright: 	Knowledge and Data Engineering Group,
// * 				Department of Computer Science,
// * 				Faculty of Engineering and Systems Science,
// * 				Trinity College
// * 				Dublin 2
// * 				Ireland
// *

var SPARQL = function (queryEndpointURL, updateEndpointURL, graphURI) {

    var queryEndpoint = queryEndpointURL;
    var updateEndpoint = updateEndpointURL;
    var graph = graphURI;
    var prefix = "";

    this.setQueryEndpoint = function (endpoint) {
        queryEndpoint = endpoint;
    };
    this.getQueryEndpoint = function () {
        return queryEndpoint;
    };

    this.setUpdateEndpoint = function (endpoint) {
        updateEndpoint = endpoint;
    };
    this.getUpdateEndpoint = function () {
        return updateEndpoint;
    };

    this.setGraph = function (graphURI) {
        graph = graphURI;
    };
    this.getGraph = function () {
        return graph;
    };

    this.addPrefix = function (string) {
        prefix += " " + string + " ";
    };

    this.sparql_query = function sparql_query (query_str, sparql) {
        var querypart = "query=" + encodeURIComponent(query_str); // escape makes the string ASCII-portable
        var xmlhttp = new XMLHttpRequest (); // ajax
        xmlhttp.open ('POST', queryEndpoint, false); // GET can have caching probs, so POST. NOT ASYNCHRONOUS - WAIT
        // probably need these headers
        xmlhttp.setRequestHeader ('Content-type', 'application/x-www-form-urlencoded');
        xmlhttp.setRequestHeader ("Accept", "application/sparql-results+json");
        // Set up callback to get the response asynchronously.
        xmlhttp.onreadystatechange = function () {
            if (xmlhttp.readyState == 4 && xmlhttp.status != 200) {
                // Some kind of error occurred.
                alert("Sparql query error: " + xmlhttp.status + " " + xmlhttp.responseText + "\n\n" + query_str);
            }
        };
        // Send the query to the endpoint.
        xmlhttp.send (querypart);
        // here we have the query result in a string, let's convert it to json, then return a JS object
        return eval("(" + xmlhttp.responseText + ")");
    };

    this.runQuery = function (query, max_results, max_vars) {
        var results = this.sparql_query(prefix + query);
        if (results.results.bindings.length > max_results) {
            console.log("Error d_lu_1: Too many results from query");
            console.log(results);
        } else if (results.results.bindings.length == 0) {
            console.log("Error d_lu_2: Too few results from query");
            console.log(results);
        } else if (results.head.vars.length > max_vars) {
            console.log("Error d_lu_3: Too many variables from query");
            console.log(results);
        } else if (results.head.vars.length == 0) {
            console.log("Error d_lu_3: Too few variables from query");
            console.log(results);
        }
        return results;
    };

    this.simpleQuery = function(query) {
        return this.sparql_query(prefix + query).results.bindings;
    };

    this.sparql_update = function (query_str, sparql) {
        var querypart = "update=" + encodeURIComponent(query_str); // escape makes the string ASCII-portable
        var xmlhttp = new XMLHttpRequest (); // ajax
        xmlhttp.open ('POST', updateEndpoint, false); // GET can have caching probs, so POST. NOT ASYNCHRONOUS - WAIT
        // probably need these headers
        xmlhttp.setRequestHeader ('Content-type', 'application/x-www-form-urlencoded');
        xmlhttp.setRequestHeader ("Accept", "application/sparql-results+json");
        // Set up callback to get the response asynchronously.
        xmlhttp.onreadystatechange = function () {
            if (xmlhttp.readyState == 4 && xmlhttp.status != 200) {
                // Some kind of error occurred.
                alert("Sparql update error: " + xmlhttp.status + " " + xmlhttp.responseText + "\n\n" + query_str);
            }
        };
        // Send the query to the endpoint.
        xmlhttp.send (querypart);
    };

    this.runUpdate = function (query) {
        this.sparql_update(prefix + query);
    };
};