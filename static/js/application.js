Game = {
    gameId: null,

    players: null,

    getPlayers: function() {
        return $('#players .player');
    },

    getPlayer: function(playerId) {
        return $('#players .player[data-id="' + playerId + '"]');
    },

    setCard: function($card, rank, suit) {
        x = 0;
        y = 0;

        if ($card.hasClass('small')) {
            url = "static/images/cards-small.png";
            width = 24;
            height = 40;
        }
        else if ($card.hasClass('medium')) {
            url = "static/images/cards-medium.png";
            width = 45;
            height = 75;
        }
        else {
            url = "static/images/cards-large.png";
            width = 75;
            height = 125;
        }

        if (rank !== undefined || suit !== undefined) {
            switch (suit) {
                case 0:
                    // Spades
                    x -= width;
                    y -= height;
                    break;
                case 1:
                    // Clubs
                    y -= height;
                    break;
                case 2:
                    // Diamonds
                    x -= width;
                    break;
                case 3:
                    // Hearts
                    break;
                default:
                    throw "Invalid suit";
            }

            if (rank == 14) {
                rank = 1;
            }
            else if (rank < 1 || rank > 13) {
                throw "Invalid rank";
            }

            x -= (rank - 1) * 2 * width + width;
        }

        $card.css('background-position', x + "px " + y + "px");
        $card.css('background-image', 'url(' + url + ')');
    },

    newGame: function(message) {
        this.gameId = message.game_id;
        this.players = message.players;

        for (playerIdKey in message.player_ids) {
            $player = this.getPlayer(message.player_ids[playerIdKey]);
            $cards = $('.cards', $player);
            $cards.append('<div class="card small pull-left" data-key="0"></div>');
            $cards.append('<div class="card small pull-left" data-key="1"></div>');
            $cards.append('<div class="card small pull-left" data-key="2"></div>');
            $cards.append('<div class="card small pull-left" data-key="3"></div>');
            $cards.append('<div class="card small pull-left" data-key="4"></div>');

            if (playerId == message.dealer_id) {
                $player.addClass('dealer');
            }
            if (playerId == $('#current-player').attr('data-id')) {
                $player.addClass('current');
            }
        }
        $('#current-player').show();
    },

    gameOver: function(message) {
        $('.player').removeClass('fold');
        $('.player').removeClass('winner');
        $('.player').removeClass('looser');
        $('.player').removeClass('dealer');
        $('#pots').empty();
        $('.cards', this.getPlayers()).empty();
        $('.bet-wrapper', this.getPlayers()).empty();
        $('#current-player').hide();
    },

    updatePlayer: function(player) {
        $player = this.getPlayer(player.id);
        $('.player-money', $player).text('$' + parseInt(player.money));
        $('.player-name', $player).text(player.name);
    },

    playerFold: function(player) {
        this.getPlayer(player.id).addClass('fold');
    },

    updatePlayers: function(players) {
        for (k in players) {
            this.updatePlayer(players[k]);
        }
    },

    updatePlayersBet: function(bets) {
        // Remove bets
        $('.bet-wrapper', this.getPlayers()).empty();
        if (bets !== undefined) {
            for (playerId in bets) {
                bet = parseInt(bets[playerId]);
                if (bet > 0) {
                    $bet = $('<div class="bet"></div>');
                    $bet.text('$' + parseInt(bets[playerId]));
                    $('.bet-wrapper', this.getPlayer(playerId)).append($bet);
                }
            }
        }
    },

    updatePlayersCards: function(players) {
        for (playerId in players) {
            $cards = $('.cards', this.getPlayer(playerId));
            for (cardKey in players[playerId].cards) {
                $card = $('.card[data-key=' + cardKey + ']', $cards);
                this.setCard(
                    $card,
                    players[playerId].cards[cardKey][0],
                    players[playerId].cards[cardKey][1]
                );
            }
        }
    },

    updatePots: function(pots) {
        $('#pots').empty();
        for (potIndex in pots) {
            $('#pots').append($(
                '<div class="pot">' +
                '$' + parseInt(pots[potIndex].money) +
                '</div>'
            ));
        }
    },

    setWinners: function(pot) {
        this.getPlayers().removeClass('winner');
        this.getPlayers().removeClass('looser');
        for (playerIdKey in pot.player_ids) {
            playerId = pot.player_ids[playerIdKey];

            $player = this.getPlayer(playerId);
            if (pot.winner_ids.indexOf(playerId) != -1) {
                $player.addClass('winner');
            }
            else {
                $player.addClass('looser');
            }
        }
    }
}


Poker5 = {
    socket: null,

    betMode: false,

    cardsChangeMode: false,

    roomId: null,

    gameId: null,

    scoreCategories: {
        0: "Highest card",
        1: "Pair",
        2: "Double pair",
        3: "Three of a kind",
        4: "Straight",
        5: "Full house",
        6: "Flush",
        7: "Four of a kind",
        8: "Straight flush"
    },

    log: function(text) {
        $p0 = $('#game-status p[data-key="0"]');
        $p1 = $('#game-status p[data-key="1"]');
        $p2 = $('#game-status p[data-key="2"]');
        $p3 = $('#game-status p[data-key="3"]');
        $p4 = $('#game-status p[data-key="4"]');

        $p4.text($p3.text());
        $p3.text($p2.text());
        $p2.text($p1.text());
        $p1.text($p0.text());
        $p0.text(text);
    },

    init: function() {
        wsScheme = window.location.protocol == "https:" ? "wss://" : "ws://";

        this.socket = new WebSocket(wsScheme + location.host + "/poker5");

        this.socket.onopen = function() {
            Poker5.log('Connected :)');
        };

        this.socket.onclose = function() {
            Poker5.log('Disconnected :(');
            Poker5.destroyRoom();
        };

        this.socket.onmessage = function(message) {
            var data = JSON.parse(message.data);

            console.log(data);

            switch (data.message_type) {
                case 'ping':
                    Poker5.socket.send(JSON.stringify({'message_type': 'pong'}));
                    break;
                case 'connect':
                    Poker5.onConnect(data);
                    break;
                case 'disconnect':
                    Poker5.onDisconnect(data);
                    break;
                case 'room-update':
                    Poker5.onRoomUpdate(data);
                    break;
                case 'set-cards':
                    Poker5.onSetCards(data);
                    break;
                case 'game-update':
                    Poker5.onGameUpdate(data);
                    break;
                case 'error':
                    Poker5.log(data.error);
                    break;
            }
        };

        $('#current-player .card').click(function() {
            if (Poker5.cardsChangeMode) {
                $(this).toggleClass('selected');
            }
        });

        $('#change-cards-cmd').click(function() {
            discards = [];
            $('#current-player .card.selected').each(function() {
                discards.push($(this).data('key'))
            });
            Poker5.socket.send(JSON.stringify({
                'message_type': 'change-cards',
                'cards': discards
            }));
            Poker5.setCardsChangeMode(false);
        });

        $('#fold-cmd, #no-bet-cmd').click(function() {
            Poker5.socket.send(JSON.stringify({
                'message_type': 'bet',
                'bet': -1
            }));
            Poker5.disableBetMode();
        });

        $('#bet-cmd').click(function() {
            Poker5.socket.send(JSON.stringify({
                'message_type': 'bet',
                'bet': $('#bet-input').val()
            }));
            Poker5.disableBetMode();
        });

        this.setCardsChangeMode(false);
        this.disableBetMode();
    },

    onGameUpdate: function(message) {
        this.resetControls();
        this.resetTimers();

        switch (message.event) {
            case 'new-game':
                Game.newGame(message);
                break;
            case 'game-over':
                Game.gameOver();
                break;
            case 'fold':
                Game.playerFold(message.player);
                break;
            case 'bet':
                Game.updatePlayer(message.player);
                Game.updatePlayersBet(message.bets);
                break;
            case 'pots-update':
                Game.updatePlayers(message.players);
                Game.updatePots(message.pots);
                Game.updatePlayersBet();  // Reset the bets
                break;
            case 'player-action':
                this.onPlayerAction(message);
                break;
            case 'dead-player':
                // Will be handled by an upcoming room-update message
                break;
            case 'add-shared-cards':
                // Not supported yet
                // Game.addSharedCards(message.cards);
                break;
            case 'winner-designation':
                Game.updatePlayers(message.players);
                Game.updatePots(message.pots);
                Game.setWinners(message.pot);
                break;
            case 'showdown':
                Game.updatePlayersCards(message.players);
                break;
        }
    },

    onConnect: function(message) {
        this.log("Connection established with poker5 server: " + message.server_id);
        $('#current-player').data('id', message.player.id);
    },

    onDisconnect: function(message) {

    },

    onError: function(message) {
        Poker5.log(message.error);
    },

    onTimeout: function(message) {
        Poker5.log('Time is up!');
        Poker5.disableBetMode();
        Poker5.setCardsChangeMode(false);
    },

    createPlayer: function(player=undefined) {
        if (player === undefined) {
            return $('<div class="player"><div class="player-info"></div></div>');
        }
        isCurrentPlayer = player.id == $('#current-player').data('id');

        $playerName = $('<p class="player-name"></p>');
        $playerName.text(isCurrentPlayer ? 'You' : player.name);

        $playerMoney = $('<p class="player-money"></p>');
        $playerMoney.text('$' + parseInt(player.money));

        $playerInfo = $('<div class="player-info"></div>');
        $playerInfo.append($playerName);
        $playerInfo.append($playerMoney);

        $player = $('<div class="player' + (isCurrentPlayer ? ' current' : '') + '"></div>');
        $player.attr('data-id', player.id);
        $player.append($playerInfo);
        $player.append($('<div class="bet-wrapper"></div>'));
        $player.append($('<div class="cards"></div>'));
        $player.append($('<div class="timer"></div>'));

        return $player;
    },

    destroyRoom: function() {
        Game.gameOver();
        this.roomId = null;
        $('#players').empty();
    },

    initRoom: function(message) {
        this.roomId = message.room_id;
        // Initializing the room
        $('#players').empty();
        for (k in message.player_ids) {
            $seat = $('<div class="seat"></div>');
            $seat.attr('data-key', k);

            playerId = message.player_ids[k];

            if (playerId) {
                // This seat is taken
                $seat.append(this.createPlayer(message.players[playerId]));
                $seat.attr('data-player-id', playerId);
            }
            else {
                $seat.append(this.createPlayer());
                $seat.attr('data-player-id', null);
            }
            $('#players').append($seat);
        }
    },

    onRoomUpdate: function(message) {
        switch (message.event) {
            case 'init':
                this.initRoom(message);
                break;

            case 'player-added':
                playerId = message.player_id;
                player = message.players[playerId]
                playerName = playerId == $('#current-player').data('id') ? 'You' : player.name;
                // Go through every available seat, find the one where the new player should sat and seated him
                $('.seat').each(function() {
                    seat = $(this).attr('data-key');
                    if (message.player_ids[seat] == playerId) {
                        $(this).empty();
                        $(this).append(Poker5.createPlayer(player));
                        $(this).attr('data-player-id', playerId);
                        return;
                    }
                });
                this.log(playerName + " joined the room");
                break;

            case 'player-removed':
                playerId = message.player_id;
                playerName = $('.player[data-id=' + playerId + '] .player-name').text();
                // Go through every available seat, find the one where the leaving player sat and kick him out
                $('.seat').each(function() {
                    seatedPlayerId = $(this).attr('data-player-id');
                    if (seatedPlayerId == playerId) {
                        $(this).empty();
                        $(this).append(Poker5.createPlayer());
                        $(this).attr('data-player-id', null);
                        return;
                    }
                });
                this.log(playerName + " left the room");
                break;
        }
    },

    onSetCards: function(message) {
        for (cardKey in message.cards) {
            $card = $('#current-player .card[data-key=' + cardKey + ']');
            Game.setCard(
                $card,
                message.cards[cardKey][0],
                message.cards[cardKey][1]
            );
        }
        $('#current-player .cards .category').text(Poker5.scoreCategories[message.score.category]);
        $('#current-player').data('allowed-to-open', message.allowed_to_open);
    },

    onBet: function(message) {
        Poker5.enableBetMode(message);
        $("html, body").animate({ scrollTop: $(document).height() }, "slow");
    },

    onChangeCards: function(message) {
        this.setCardsChangeMode(true);
        $("html, body").animate({ scrollTop: $(document).height() }, "slow");
    },

    onPlayerAction: function(message) {
        isCurrentPlayer = message.player.id == $('#current-player').data('id');

        switch (message.action) {
            case 'bet':
                if (isCurrentPlayer) {
                    this.log('Your turn to bet');
                    this.onBet(message);
                }
                else {
                    this.log('Waiting for ' + message.player.name + ' to bet...');
                }
                break;
            case 'change-cards':
                if (isCurrentPlayer) {
                    this.log('Your turn to change cards');
                    this.onChangeCards(message);
                }
                else {
                    this.log('Waiting for ' + message.player.name + ' to change cards...');
                }
                break;
        }

        $timers = $('.player[data-id="' + message.player.id + '"] .timer');
        $timers.data('timer', message.timeout);
        $timers.TimeCircles({
            "start": true,
            "animation": "smooth",
            "bg_width": 1,
            "fg_width": 0.05,
            "count_past_zero": false,
            "time": {
                "Days": { show: false },
                "Hours": { show: false },
                "Minutes": { show: false },
                "Seconds": { show: true }
            }
        });
        $timers.addClass('active');
    },

    resetTimers: function() {
        // Reset timers
        $activeTimers = $('.timer.active');
        $activeTimers.TimeCircles().destroy();
        $activeTimers.removeClass('active');
    },

    resetControls: function() {
        // Reset controls
        this.setCardsChangeMode(false);
        this.disableBetMode();
    },

    sliderHandler: function(value) {
        if (value == 0) {
            $('#bet-cmd').attr("value", "Check");
        }
        else {
            $('#bet-cmd').attr("value", "$" + parseInt(value));
        }
        $('#bet-input').val(value);
    },

    enableBetMode: function(message) {
        this.betMode = true;

        if (!message.opening || $('#current-player').data('allowed-to-open')) {
            // Set-up slider
            $('#bet-input').slider({
                'min': parseInt(message.min_bet),
                'max': parseInt(message.max_bet),
                'value': parseInt(message.min_bet),
                'formatter': this.sliderHandler
            }).slider('setValue', parseInt(message.min_bet));

            // Fold control
            if (message.opening) {
                $('#fold-cmd').val('Pass')
                    .removeClass('btn-danger')
                    .addClass('btn-warning');
            }
            else {
                $('#fold-cmd').val('Fold')
                    .addClass('btn-danger')
                    .removeClass('btn-warning');
            }

            $('#fold-cmd-wrapper').show();
            $('#bet-input-wrapper').show();
            $('#bet-cmd-wrapper').show();
            $('#no-bet-cmd-wrapper').hide();
        }

        else {
            $('#fold-cmd-wrapper').hide();
            $('#bet-input-wrapper').hide();
            $('#bet-cmd-wrapper').hide();
            $('#no-bet-cmd-wrapper').show();
        }

        $('#bet-controls').show();
    },

    disableBetMode: function() {
        $('#bet-controls').hide();
    },

    setCardsChangeMode: function(changeMode) {
        this.cardsChangeMode = changeMode;

        if (changeMode) {
            $('#change-cards-controls').show();
        }
        else {
            $('#change-cards-controls').hide();
            $('#current-player .card.selected').removeClass('selected');
        }
    },

    resetCards: function() {
        $('#current-player .card').each(function() {
            $card = $(this);
            $card.css('background-image', 'url(static/images/card-back.png)');
            $card.css('background-position', '0px 0px');
        });
        $('#current-player .cards .category').empty();
    }
}

$(document).ready(function() {
    Poker5.init();
})

