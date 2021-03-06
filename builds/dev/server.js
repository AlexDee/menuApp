'use strict';

global.__approot = __dirname;

var express = require('express');
var app = express();
var path = require('path');
var mime = require('mime');
var http = require('http').Server(app);
var io = require('socket.io')(http);
var ejs = require('ejs');
var multipart = require('connect-multiparty');
var multipartMiddleware = multipart();

var bodyParser = require('body-parser');
var fs = require('fs');

var pdf = require('./ext/pdf');
var xlsx = require('./ext/xlsx');

//var db = require('./ext/db/db');

var Menu = require('./ext/db/schema/menu');
var Image = require('./ext/db/schema/image');
var Product = require('./ext/db/schema/product');
var Group = require('./ext/db/schema/group');

app.set('port', (process.env.PORT || 3000));
app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');
app.use(express.static(__dirname + "/static"));
app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});


process.on('uncaughtException', function (err) {
    console.log(err);
});

io.sockets.on('connection', function (client) {

    Group.find({}, function(err, products){
        client.emit('updateGroups', products);
    });

    Menu.find({})
        .populate('products image')
        .exec(function (err, menus) {
            client.emit('updateMenuList', menus);
        });

    Image.find({}, function(err, images) {
        client.emit('updateImages', images);
    });

    client.on('updateProducts', function (products) {
        var length = products.length;

        for(var i in products){
            var prod = new Product();
            for(var j in products[i]){
                prod[j] = products[i][j]
            }
            prod.replace(function(){
                length--;
                if(length===0){
                    Product.find({}, function(err, products) {
                        client.emit('showProducts', products);
                    });
                }
            });
        }
    });

    client.on('updateImages', function (images) {
        for(var i in images){
            var im = new Image();
            for(var j in images[i]){
                im[j] = images[i][j]
            }
            im.replace();
        }
    });

    client.on('updateMenu', function (menu) {
        var m = new Menu(menu)
        m.replace(function(){
            Menu.find({}, function(err, menus) {
                client.emit('updateMenuList', menus);
            })
        });
    });

    client.on('createPDF', function (menu) {
        pdf.create(menu,function(fileURL){
            client.emit('downloadFile', fileURL);
        });
    });

    client.on('getPDF', function (menu) {
        var html = pdf.get(menu);
        client.emit('showPDF', html);
    });

    client.on('deleteImage', function (imageId) {
        Image.findOne({_id:imageId}, function(err, image){
            image.remove();
        });
    });

    client.on('getImages', function () {
        Image.find({}, function(err, images) {
            client.emit('updateImages', images);
        });
    });

});

app.get('/groups', function (req, res) {
    Group.find({}, null, {sort: {'code': 1}}, function(err, groups){
        res.send(groups);
    });
});

app.get('/products', function (req, res) {
    Product.fetch(function(err, products){
        res.send(products);
    });
});


app.get('/menu.json', function (req, res) {
    Menu.find({}, function(err, menu) {
        res.send(JSON.stringify(menu));
    })
});

app.get('/files/:file', function(req, res){
    var file = __dirname + '/files/' + req.params.file;
    var filename = path.basename(file);
    var mimetype = mime.lookup(file);

    res.setHeader('Content-disposition', 'attachment; filename=' + filename);
    res.setHeader('Content-type', mimetype);

    var filestream = fs.createReadStream(file);
    filestream.pipe(res);
});


app.post('/menu.json', function (req, res) {

    for(var i in req.body){
        var menu = new Menu();
        for(var j in req.body[i]){
            prod[j] = req.body[i][j]
        }
        prod.replace();
    }
    res.json(req.body);
});



app.get('/', function (req, res) {
    res.render('index.ejs');
});


app.post('/image', multipartMiddleware, function(req, res) {
    if(typeof req.files!='undefined'){
        for(var i in req.files){
            var image = new Image();
            image.saveIMG(req.files[i],function(){
                res.send('ОК');
            });
        }
    }
});

app.post('/', multipartMiddleware, function(req, res) {
    if(typeof req.files!='undefined' && req.files.file.name.split('.').pop() === 'xlsx'){
        xlsx.parse(req.files, function(){
            res.send('ОК');
        })
    }
});


var server = http.listen(app.get('port'), function () {
    var host = server.address().address;
    var port = server.address().port;
    console.log('Example app listening at http://%s:%s', host, port);
});