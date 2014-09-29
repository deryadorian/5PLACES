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
            templateUrl: 'main.html',
            controller: 'mainCtrl'
        })

        .state('fav', {
            url: '/fav',
            templateUrl: 'fav.html',
            controller: 'favCtrl'
        })

        .state('info', {
            url: '/info',
            templateUrl: 'info.html',
            controller: 'infoCtrl'
        })

        .state('map', {
            url: '/map',
            templateUrl: 'map.html',
            controller: 'mapCtrl'
        })

        .state('details', {
            url: '/details',
            templateUrl: 'details.html',
            controller: 'detailsCtrl'
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
            var max = 45;
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
    var restaurant_service          = this;
    this.page                       = 0;
    this.selected_restaurant_index  = 0;
    this.currentPosition            = {};

    this.loadData = function() {
        var restaurant_list = localStorage.fivePlacesRestaurantList;
        if (!restaurant_list) return restaurantData;
         return JSON.parse(restaurant_list);
    };

    this.saveData = function() {
        localStorage.fivePlacesRestaurantList = JSON.stringify(restaurant_service.restaurant_list);
    };


    this.restaurant_list = this.loadData();


    this.getRestaurantList = function() {
        return this.restaurant_list;
    };


    this.setRestaurantList = function(rlist) {
        restaurant_service.restaurant_list = rlist;
        return restaurant_service.restaurant_list;
    };


    this.updateDistance = function(position) {
        restaurant_service.currentPosition = position;
        var latitude   = restaurant_service.currentPosition.coords.latitude;
        var longitude  = restaurant_service.currentPosition.coords.longitude;
        for (var i=0, len_data=restaurant_service.restaurant_list.length; i<len_data; i++) {
            var restaurant      = restaurant_service.restaurant_list[i];
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
        return restaurant_service.restaurant_list;
    };


    this.getPosition = function() {
        gps.getCurrentPosition().then(
            function(position) {
                return restaurant_service.updateDistance(position);
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
    //  'http://s3-us-west-2.amazonaws.com/5places2eat/restaurant_data.json',
        'https://dl.dropboxusercontent.com/u/16617673/restaurants.json',
        {},
        {
            query: {
                method:'JSONP',
                isArray:true,
                cache: false,
            }
        }
    );


    this.refresh = function() {
        var deferred = $q.defer();
        this.restaurants_resource.query(

            function(response) {
                restaurant_service.setRestaurantList(response);
                restaurant_service.updateDistance(restaurant_service.currentPosition);
                deferred.resolve(response);
            },

            function(error) { deferred.reject(error); }

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

          delete_fav: function(idx) {
                var restaurants = localStorage.fivePlaces;
                if (!restaurants) restaurants = [];
                else              restaurants = JSON.parse(restaurants);
                var pos = restaurants.indexOf(idx);
                if (pos != -1) {
                    restaurants.splice(pos, 1);
                    localStorage.fivePlaces = JSON.stringify(restaurants);
                };
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
        restaurants.refresh()
        .then(
            function() {
                $scope.restaurants = getXRestaurants( restaurants.getRestaurantList(), $scope.page, 5 );
                $scope.change_restaurant( $scope.selected_restaurant_index );
                restaurants.saveData();
            },
            function(error) {
                console.log(error);
            }
        );

        $scope.$broadcast('scroll.refreshComplete');
    };

    $scope.jsonCallback = function(data) {
        restaurants.setRestaurantList(data);
        restaurants.updateDistance(restaurants.currentPosition);
        $scope.restaurants = getXRestaurants( restaurants.getRestaurantList(), $scope.page, 5 );
        $scope.change_restaurant( $scope.selected_restaurant_index );
        restaurants.saveData();
    };

    $scope.change_restaurant = function(index) {
        index = $scope.page * 5 + index;
        $scope.selected_restaurant_index = restaurants.changeSelectedRestaurantIndex(index);
        $scope.selected_restaurant       = restaurants.getRestaurantList()[index];
        $scope.active_index              = $scope.selected_restaurant_index % 5;
    };


    $scope.next = function() {
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
        var restaurant = $scope.restaurants[idx];
        restaurant.index = idx
        $scope.favourites.push(restaurant);
    }

    $scope.info = function(favourite_idx) {
        restaurants.changeSelectedRestaurantIndex(favourite_idx);
        $state.go("details");
    };

    $scope.map = function(favourite_idx) {
        restaurants.changeSelectedRestaurantIndex(favourite_idx);
        $state.go("map");
    };

    $scope.delete_fav = function(favourite_idx) {
        debugger
        favourites.delete_fav(favourite_idx);
        for (var i=0, len=$scope.favourites.length; i<len; i++) {
            if ($scope.favourites[i].index == favourite_idx) {
                $scope.favourites.splice( i, 1 );
                break;
            }
        }
    };

    $scope.show = function(favourite_idx) {
        debugger
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
                        $scope.info(favourite_idx);
                        break;
                    case 1:
                        $scope.map(favourite_idx);
                        break;
                }
                return true;
            },
            destructiveButtonClicked: function(index) {
                $scope.delete_fav(favourite_idx);
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
    $scope.addToFavourites           = function(selected_restaurant_index) {
        document.getElementById("id-fav-add").classList.toggle("fav-add", true);
        favourites.add(selected_restaurant_index);
        window.setTimeout( function() { document.getElementById("id-fav-add").classList.toggle("fav-add", false); }, 1000 );
    };

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

function jsonCallback(data) {
    angular.element( document.getElementById("main") ).scope().jsonCallback(data);
    return data;
}
