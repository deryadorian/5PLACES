/*jshint strict:false */
"use strict";

angular.module('places5', ['ionic', 'ngResource', 'places5.data'])

.run(['$ionicPlatform', function($ionicPlatform) {
  $ionicPlatform.ready(function() {
    // Hide the accessory bar by default (remove this toshow the accessory bar above the keyboard for form inputs)
    if(window.cordova && window.cordova.plugins.Keyboard) {
      cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);
    }
    if(window.StatusBar) {
      StatusBar.styleDefault();
    }
  });
}])

//********************************************************

.config( [ "$stateProvider", "$urlRouterProvider", function($stateProvider, $urlRouterProvider) {

    $stateProvider

        .state('main', {
            url: '/main',
            templateUrl: 'main.html'
        })

        .state('fav', {
            url: '/fav',
            templateUrl: 'fav.html'
        })

        .state('info', {
            url: '/info',
            templateUrl: 'info.html'
        })

        .state('map', {
            url: '/map',
            templateUrl: 'map.html'
        })

        .state('details', {
            url: '/details',
            templateUrl: 'details.html'
        });


    $urlRouterProvider.otherwise("/main");

}])

//********************************************************
//********************************************************
//********************************************************

.factory( "compass", [ "$timeout", function compassFactory($timeout) {

    return {
        magneticHeading: null,

        onSuccess: function(heading) {
            window.alert( "Heading: " + heading.magneticHeading );
        },

        onError: function(compassError) {
            window.alert('Compass Error: ' + compassError.code);
        },

        getCurrentHeading: function(onSuccess, onError) {
            if (!navigator.compass) {
                onError();
                return;
            }

            var success = onSuccess || this.onSuccess,
                error   = onError   || this.onError;
            if (this.magneticHeading === null) {
                this.magneticHeading = true;
                navigator.compass.getCurrentHeading( function(){}, function(){} );
                $timeout( function() { navigator.compass.getCurrentHeading(success, error); }, 1000 );
            }
            else {
                navigator.compass.getCurrentHeading(success, error);
            }
        }
    };

}])

//********************************************************

.factory( "gps", ["$q", function gpsFactory($q) {

    return {

        toRadians: function(degrees) {
            return degrees * Math.PI / 180;
        },

        toDegrees: function(radians) {
            return radians * 180 /  Math.PI;
        },

        getCurrentPosition: function(timeout) {
            timeout = timeout || 5000;
            var deferred = $q.defer();
            navigator.geolocation.getCurrentPosition(
                function(position) { deferred.resolve(position); },
                function(error)    { deferred.reject(error);     },
                { timeout:timeout }
            );
            return deferred.promise;
        },

        getDistance: function(latitude1, longitude1, latitude2, longitude2) {
            if ( latitude1  === undefined ||
                 longitude1 === undefined ||
                 latitude2  === undefined ||
                 longitude2 === undefined
            ) return "";

            Number.prototype.toRadians = function() {
                return this * Math.PI / 180;
            };

            var R = 6371;  // radius of the earth in kilometers
            var deltaLatitude  = (latitude2   - latitude1 ).toRadians();
            var deltaLongitude = (longitude2 - longitude1).toRadians();
            latitude1 = latitude1.toRadians();
            latitude2 = latitude2.toRadians();

            var a = Math.sin(deltaLatitude/2) *
                    Math.sin(deltaLatitude/2) +
                    Math.cos(latitude1) *
                    Math.cos(latitude2) *
                    Math.sin(deltaLongitude/2) *
                    Math.sin(deltaLongitude/2);
            var c = 2 * Math.atan2(Math.sqrt(a),
                                   Math.sqrt(1-a));
            var d = R * c;
            return d;
            },

        getPct: function(coordinate) {
            var sign = (coordinate < 0)? -1 : 1;
            return Math.min( Math.abs(coordinate) * 7.5, 45) * sign;
        },

        getXY: function(x,y) {
            var max = 45
            x     = this.getPct(x);
            y     = this.getPct(y);
            var z = Math.sqrt(x*x + y*y);
            if (z > max) {
                var angle = y/x * 180 / Math.PI;
                x         = Math.cos(angle) * max;
                y         = Math.sin(angle) * max;
            }
            return [ x + "%", y + "%" ];
        }


    };

}])

//********************************************************

.service( "restaurants", ["$resource", "$q", "restaurantData", "gps", function($resource, $q, restaurantData, gps) {
    this.page                       = 0;
    this.selected_restaurant_index  = 0;
    this.restaurant_list            = restaurantData;
    this.currentPosition            = {};

    var restaurant_list             = this.restaurant_list;
    var currentPosition             = this.currentPosition;

    this.getRestaurantList = function() {
        return this.restaurant_list;
    };

    this.setRestaurantList = function(rlist) {
        restaurant_list = rlist;
        return restaurant_list;
    };


    this.updateDistance = function(position) {
        currentPosition = position;
        var latitude   = currentPosition.coords.latitude;
        var longitude  = currentPosition.coords.longitude;
        for (var i=0, len_data=restaurant_list.length; i<len_data; i++) {
            var restaurant      = restaurant_list[i];
            restaurant.index    = i;
            restaurant.X        = (restaurant.Latitude   - latitude  ) * 111.19;
            restaurant.Y        = (restaurant.Longitude  - longitude ) * 111.19;
            var xy              = gps.getXY(restaurant.X, restaurant.Y);
            restaurant.left     = xy[0];
            restaurant.top      = xy[1];
            restaurant.distance = gps.getDistance(
                latitude, longitude,
                parseFloat(restaurant.Latitude), parseFloat(restaurant.Longitude)
            ).toFixed(1) + " km";
        }
        return restaurant_list;
    };


    var updateDistance  = this.updateDistance;


    this.getPosition = function() {
        gps.getCurrentPosition().then(
            function(position) {
                return updateDistance(position);
            },

            function(error) {
                window.alert(
                    'GPS error\n' +
                    'code: '    + error.code    + '\n' +
                    'message: ' + error.message + '\n');
            }
        );
    };


    this.changeSelectedRestaurantIndex = function(index) {
        this.selected_restaurant_index = index;
        return index;
    };


    this.changePage = function(pageno) {
        this.page = pageno;
        return pageno;
    };


    this.restaurants_resource = $resource(
        'restaurants.json',
        {},
        {
            query: {
                method:'GET',
                isArray:true,
                cache: false
            }
        }
    );


    this.refresh = function() {
        var setRestaurantList = this.setRestaurantList;
        var deferred = $q.defer();
        this.restaurants_resource.query(

            function(response) {
                setRestaurantList(response);
                updateDistance(currentPosition);
                deferred.resolve(response);
            },

            function(error)    { deferred.reject(error);     }

        );
        return deferred.promise;
    };


}])

//********************************************************

.factory( "favourites", [function favoritesFactory() {
        return {

            get: function(idx) {
                var restaurants;
                if (idx === undefined) {
                    restaurants = localStorage.fivePlaces;
                    if (!restaurants) return [];
                    return JSON.parse(restaurants);
                }
                else {
                    restaurants = localStorage.fivePlaces;
                    return JSON.parse(restaurants)[idx];
                }
            },

            add: function(idx) {
                var restaurants = localStorage.fivePlaces;
                if (!restaurants) restaurants = [];
                else              restaurants = JSON.parse(restaurants);
                if (restaurants.indexOf(idx) == -1) {
                    restaurants.push(idx);
                }
                localStorage.fivePlaces = JSON.stringify(restaurants);
            },

            delete: function(idx) {
                var restaurants = localStorage.fivePlaces;
                if (!restaurants) restaurants = [];
                else              restaurants = JSON.parse(restaurants);
                if (restaurants.indexOf(idx) != -1)  restaurants.splice(idx, 1);
                localStorage.fivePlaces = JSON.stringify(restaurants);
            }

        };
}])

//********************************************************
//********************************************************
//********************************************************

.controller( "mainCtrl", [
                '$scope',
                "$ionicActionSheet",
                "compass",
                "gps",
                "restaurants",
                "favourites",
                function(
                    $scope,
                    $ionicActionSheet,
                    compass,
                    gps,
                    restaurants,
                    favourites
                 ) {

    function getAvgCoords(restaurants) {
        var len=restaurants.length;
        for (var i=0, latitude=0, longitude=0; i < len; i++) {
            var restaurant = restaurants[i];
            latitude   += parseFloat(restaurant.Latitude  ) ;
            longitude  += parseFloat(restaurant.Longitude);
        }
        return {
            coords: {
                latitude:  latitude  / len,
                longitude: longitude / len
            }
        };
    }

    function getXRestaurants(restaurant_list, pageno, limit) {
        var restaurants = [];
        var start = pageno * limit;
        for (var i=0; i<limit; i++) {
            restaurants[i] = restaurant_list[ start + i ];
        }
        return restaurants;
    }

    $scope.page        = restaurants.page;
    $scope.restaurants = getXRestaurants( restaurants.getRestaurantList(), $scope.page, 5 );
    var position       = getAvgCoords( $scope.restaurants );
    restaurants.updateDistance(position);
    restaurants.getPosition();
    $scope.selected_restaurant_index = restaurants.selected_restaurant_index;
    $scope.active_index              = $scope.selected_restaurant_index % 5;
    $scope.selected_restaurant       = restaurants.getRestaurantList()[$scope.selected_restaurant_index];
    $scope.currentHeading            = 0;


    $scope.doRefresh = function() {
        restaurants.refresh().then( function() {
            $scope.restaurants = getXRestaurants( restaurants.getRestaurantList(), $scope.page, 5 );
// console.log("===", restaurants.getRestaurantList()[0])
        });
        $scope.$broadcast('scroll.refreshComplete');
    };


    $scope.change_restaurant = function(index) {
        index = $scope.page * 5 + index;
        $scope.selected_restaurant_index = restaurants.changeSelectedRestaurantIndex(index);
        $scope.selected_restaurant       = restaurants.getRestaurantList()[index];
        $scope.active_index              = $scope.selected_restaurant_index % 5;
    };


//     function rotate(x, y, degrees) {
//         degrees = gps.toRadians( degrees );
//         x = parseFloat( x.substr(0, x.length - 1) );
//         y = parseFloat( y.substr(0, y.length - 1) );
//         x = x * Math.cos(degrees) - y * Math.sin(degrees);
//         y = y * Math.cos(degrees) + x * Math.sin(degrees);
//         return [x,y]
//     }
//     var D = 0;

    $scope.next = function() {
//         var res = restaurants.getRestaurantList()[0]
//         D += 45;
//         D = D % 360;
//         var xy = rotate($scope.restaurants[0].top, $scope.restaurants[0].left, D)
//         res.top  = xy[0] + "%";
//         res.left = xy[1] + "%";
//         console.log(res.top,res.left)
//         return

        $scope.page = restaurants.changePage( $scope.page + 1 );
        var index   = $scope.page * 5;
        if (index >= restaurants.getRestaurantList().length) {
            $scope.page = 0;
            index       = 0;
        }
        $scope.restaurants               = restaurants.getRestaurantList().slice( index, index + 5);
        $scope.selected_restaurant_index = restaurants.changeSelectedRestaurantIndex(index);
        $scope.active_index              = $scope.selected_restaurant_index % 5;
        $scope.selected_restaurant       = restaurants.getRestaurantList()[index];
    };


     $scope.show = function() {
        var hideSheet = $ionicActionSheet.show({
            buttons: [
                { text: '<i class="icon ion-ios7-information"></i> Info'   },
                { text: '<i class="icon ion-android-location"></i> Map'    },
                { text: '<i class="icon ion-ios7-heart"   ></i> Add' },
            ],
            cancelText:      '<i class="icon ion-close-circled"></i> Cancel',
            buttonClicked: function(index) {
                if (index == 2)  favourites.add( $scope.selected_restaurant_index );
                return true;
            },
            destructiveButtonClicked: function(index) {
                return true;
            }
        });
     };


/*
//  x ' = x cos f - y sin f
//  y'  = y cos f + x sin f

    $scope.next = function() {
        var restaurant  = $scope.selected_restaurant;
        var r           = Math.sqrt(
                            restaurant.Latitude   * restaurant.Latitude +
                            restaurant.Longitude * restaurant.Longitude
                          );
        $scope.currentHeading  = ($scope.currentHeading + 90) % 360;
        var radian             = $scope.currentHeading * Math.PI / 180;
        var cos0               = Math.cos(radian);
        var sin0               = Math.sin(radian);
        restaurant.X    =  restaurant.X * cos0 + restaurant.Y * sin0;
        restaurant.Y    = -restaurant.X * sin0 + restaurant.Y * cos0;
        restaurant.left = gps.getPct(restaurant.X);
        restaurant.top  = gps.getPct(restaurant.Y);
// console.log( $scope.currentHeading, restaurant.X, restaurant.Y, restaurant.left, restaurant.top );
    }
*/


}])

//********************************************************

.controller( "favCtrl", [
                 '$scope',
                 "$ionicActionSheet",
                 "$timeout",
                 "$state",
                 "restaurants",
                 "favourites",
                 function(
                     $scope,
                     $ionicActionSheet,
                     $timeout,
                     $state,
                     restaurants,
                     favourites
                 ) {

    $scope.restaurants = restaurants.restaurant_list;
    restaurants.getPosition();
    var favouriteIndices = favourites.get();
    $scope.favourites = [];
    for (var i=0, len_fav=favouriteIndices.length; i<len_fav; i++ ) {
        var idx = favouriteIndices[i];
        $scope.favourites.push( $scope.restaurants[idx] );
    }


    $scope.show = function(favourite_idx) {
        var hideSheet = $ionicActionSheet.show({
            buttons: [
                { text: '<i class="icon ion-ios7-information"></i> Info'   },
                { text: '<i class="icon ion-android-location"></i> Map'    },
            ],
            destructiveText: '<i class="icon ion-minus-circled"></i> Delete',
            cancelText:      '<i class="icon ion-close-circled"></i> Cancel',
            buttonClicked: function(index) {
                switch (index) {
                    case 0:
                        restaurants.changeSelectedRestaurantIndex(favourite_idx);
                        $state.go("details");
                        break;
                    case 1:
                        restaurants.changeSelectedRestaurantIndex(favourite_idx);
                        $state.go("map");
                        break;
                }
                return true;
            },
            destructiveButtonClicked: function(index) {
                favourites.delete(favourite_idx);
                $scope.favourites.splice( favourite_idx, 1 );
                return true;
            }
        });
     };

}])

//********************************************************

.controller( "detailsCtrl", [
    '$scope',
    "restaurants",
    "favourites",
    function(
        $scope,
        restaurants,
        favourites
    ) {
    $scope.selected_restaurant_index = restaurants.selected_restaurant_index;
    $scope.restaurant                = restaurants.restaurant_list[$scope.selected_restaurant_index];
    $scope.favourites                = favourites;

}])

//********************************************************

.controller( "mapCtrl", [
    '$scope',
    "restaurants",
    function(
        $scope,
        restaurants
) {
    $scope.selected_restaurant_index = restaurants.selected_restaurant_index;
    $scope.restaurant                = restaurants.restaurant_list[$scope.selected_restaurant_index];
    var position                     = new google.maps.LatLng( parseFloat($scope.restaurant.Latitude), parseFloat($scope.restaurant.Longitude) );

    var mapOptions = {
        zoom: 18,
        center: position, //new google.maps.LatLng( parseFloat($scope.restaurant.Latitude), parseFloat($scope.restaurant.Longitude) )
    };
    $scope.map = new google.maps.Map(document.getElementById('map-canvas'), mapOptions);
    var marker = new google.maps.Marker({
        position: position,
        map: $scope.map,
        title: $scope.restaurant.Name,
    });
}])
;

