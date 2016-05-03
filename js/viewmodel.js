/*global $, Model, ko, ScenarioItem */
// global application variable
var app = app || {};


/**
 * @description - controller for index.html
 * @constructor
 */
var ViewModel = function () {
    'use strict';
    var self = this,
        $main = $('#map-container'),
        $nav = $('#menu-container'),
        $menuButton = $('#menu-button-container'),
        $customScenario = $('#custom'),
        $customSettings = $('#custom-settings');
    $customSettings.toggle(false);

    self.model = new Model();
    self.currentScenario = ko.observable();
    self.scenarios = ko.observableArray();
    self.scenarioTitle = ko.observable('Please choose a scenario');
    self.numOfStations = ko.observable(5);
    self.numOfDays = ko.observable(30);
    self.currentDay = ko.observable(0);

    //populate locations observable container with data from model
    self.model.getAllScenarios().forEach(function (scen) {
        self.scenarios.push(new ScenarioItem(scen));
    });

    /**
     * @description - toggles location navigation drawer (only shown when responsive
     *                css is loaded)
     */
    $menuButton.click(function (e) {
        $nav.toggleClass('open');
        e.stopPropagation();
    });

    /**
     * @description - closes navigation drawer when the main screen is clicked.
     *                (only shown when responsive css is loaded)
     */
    $main.click(function () {
        $nav.removeClass('open');
    });


    //click action for when user clicks on custom scenario from menu.
    $customScenario.click(function () {
        $customSettings.toggle("slow");
        self.scenarioTitle("Custom Scenario");
    });

    /**
     * @description - closes menu drawer and displays info window for selected pin.
     *                function is bound by Knockout.js framework in index.html
     */
    window.menuClick = function () {
        $nav.removeClass('open');
        self.currentScenario(this);
        self.scenarioTitle(self.currentScenario().name);
        $customSettings.toggle(false);
        self.numOfStations(self.currentScenario().numOfStations);
        self.numOfDays(self.currentScenario().numOfDays);
        self.buildUI();
    };

    /**
     * @description - loads custom scenario when 'Load Scenario' is clicked
     */
    window.loadCustom = function () {
        $nav.removeClass('open');
        self.numOfDays($('#days').val());
        self.numOfStations($('#stations').val());
        self.currentDay(0);
        var scenarioData = {
            name: "Custom Scenario",
            numOfStations: self.numOfStations(),
            numOfDays: self.numOfDays(),
        };
        var scenario = new ScenarioItem(scenarioData);
        self.currentScenario(scenario);

        //create stations with default data
        for (var i = 1; i <= self.numOfStations(); i++) {
            var data = {
                number: i,
                initWIP: 10,
                baseProduction: 10,
                sigma: 0
            };
            var tempStation = new StationItem(data);
            self.currentScenario().addStation(tempStation);
        }
        self.buildUI();
    }

    self.buildUI = function () {
        self.clearUI();
        $('.control').removeClass("hidden");
        var headerHTML = '<div id="scenario-data" class="scenario-data">Scenario Data' +
            '<p>Number of Days: ' + self.currentScenario().numOfDays + '</p>' +
            '<p>Number of Stations: ' + self.currentScenario().numOfStations + '</p>';
        $('#sim-header').append(headerHTML);
        $('#sim-header').append('<div id="scenario-graph" class="scenario-graph">Scenario Graph</div');
        for (var i = 1; i <= self.numOfStations(); i++) {
            var stationContainerID = 'station' + i + '-container';
            var stationHTML = '<div id="' + stationContainerID + '" class="station"></div>'
            var stationDataHTML = '<div id="station' + i + '-data" class="station-data">Station ' + i + ' Data</div>';
            var stationGraphID = 'station' + i + '-graph';
            var stationGraphHTML = '<div id="' + stationGraphID + '" class="station-graph"></div>';
            $('#station-container').append(stationHTML);
            $('#' + stationContainerID).append(stationDataHTML);
            $('#' + stationContainerID).append(stationGraphHTML);
            var text = "Day\t WIP\t     Capacity\t     Output\t     Missed"
            $('#' + stationGraphID).append('<textarea class="station-label">' + text + '</textarea>');
            $('#' + stationGraphID).append('<textarea id="station' + i + '-textarea" class="station-textarea"></textarea>');
        }
    };

    self.clearUI = function () {
        $('#scenario-data').remove();
        $('#scenario-graph').remove();
        $('.station').remove();
        $('.control').addClass("hidden");
        self.currentDay(0);
    }

    //reset
    window.reload = function () {
        self.currentScenario().reload();
        self.currentDay(0);
        $('.station-textarea').text('');
        $('.scenario-graph').text('');
    }

    window.runProduction = function () {
        var runCalc = false;
        var day = self.currentDay();
        if (self.currentScenario()) {
            if (!self.currentScenario().totalProduction()[self.currentDay + 1]) {
                runCalc = true;
            }
        }
        if (runCalc) {
            self.currentScenario().totalMissedOp()[day] = 0;
            self.currentScenario().totalProduction()[day] = 0;
            for (var i = 0; i < self.currentScenario().stations().length; i++) {
                var currentStation = self.currentScenario().stations()[i];
                var wipToAdd = 0;

                //if we are the first station, don't worry about previous station
                if (i == 0) {
                    wipToAdd = 0;
                } else {
                    //if its the first day, only work on what's in the initial WIP
                    if (self.currentDay() == 0) {
                        wipToAdd = 0;
                    } else { //its not the first day, so we need to add previous stations work
                        wipToAdd = self.currentScenario().stations()[i - 1].output()[day - 1];
                    }
                }
                currentStation.doWork(self.currentDay(), wipToAdd);
                self.currentScenario().totalMissedOp()[day] = self.currentScenario().totalMissedOp()[day] + currentStation.missedOp()[day];


                var stationID = 'station' + currentStation.number + '-textarea';
                var stationTextToAdd = '';
                var textbox = $('#' + stationID);
                textbox.text(self.currentDay() + '\t ' +
                    currentStation.wipValues()[day] + '\t\t' +
                    currentStation.productionValues()[day] + '\t\t' +
                    currentStation.output()[day] + '\t\t' +
                    currentStation.missedOp()[day] + '\n' + textbox.val());
            }

            //set total production for the day equal to last station's output for the day
            self.currentScenario().totalProduction()[day] =
                self.currentScenario().stations()[self.currentScenario().stations().length - 1].output()[day];
            self.currentDay(self.currentDay() + 1);

            printTotalResults();

        }
    };

    window.finishProduction = function () {
        while (self.currentDay() <= self.numOfDays()) {
            runProduction();
        }
    };

    window.printTotalResults = function () {
        var totalProd = 0;
        var totalMissed = 0;
        var totalHTMLText = '';
        self.currentScenario().totalProduction().forEach(function (prod) {
            totalProd += prod;
        });
        self.currentScenario().totalMissedOp().forEach(function (miss) {
            totalMissed += miss;
        });
        totalHTMLText = "Total production: " + totalProd + '\n' +
            "Total missed op: " + totalMissed;
        $('#scenario-graph').text(totalHTMLText);
    }
};

//instaniate our controller
app.viewModel = new ViewModel();
//bind the view to our ViewModel
ko.applyBindings(app.viewModel);