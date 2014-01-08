'use strict';

var async = require('async');
var NodeunitAsync = require('nodeunit-async');
var EzMongo = require('../index');

var ezMongo = new EzMongo({database: 'ezMongoTestDb'});

var na = new NodeunitAsync({
    globalSetup: _setUp,
    fixtureTeardown:  _tearDown
});

var testFixture = {
    col1: {
        docA: {num: 1, char: 'A'},
        docB: {num: 2, char: 'B'},
        docC: {num: 3, char: 'C'}
    },
    col2: {
        docX: {num: 77, char: 'X'},
        docY: {num: 88, char: 'Y'},
        docZ: {num: 99, char: 'Z'}
    }
};

function _setUp (callback) {
    async.auto({
        db: [function(next) {
            ezMongo.db(next);
        }],
        list: ['db', function(next, results) {
            results.db.collectionNames(next);
        }],
        col1: ['db', function(next, results) {
            results.db.collection('col1', next);
        }],
        drop1: ['list','col1', function(next, results) {
            if(results.list.some(function(colObj) {
                return !!colObj.name.match(/\.col1$/);
            })) {
                results.col1.drop(next);
            } else {
                next();
            }
        }],
        insert1: ['drop1', function(next, results) {
            async.each(Object.keys(testFixture.col1), function(key, eachNext) {
                var obj = testFixture.col1[key];
                obj._id = key;
                results.col1.insert(obj, eachNext);
            }, function(err) {
                next(err);
            });
        }],
        col2: ['db', function(next, results) {
            results.db.collection('col2', next);
        }],
        drop2: ['list','col2', function(next, results) {
            if(results.list.some(function(colObj) {
                return !!colObj.name.match(/\.col2$/);
            })) {
                results.col2.drop(next);
            } else {
                next();
            }
        }],
        insert2: ['drop2', function(next, results) {
            async.each(Object.keys(testFixture.col2), function(key, eachNext) {
                var obj = testFixture.col1[key];
                obj._id = key;
                results.col2.insert(obj, eachNext);
            }, function(err) {
                next(err);
            });
        }]
    }, function(err) {
        callback(err);
    });
}

function _tearDown(callback) {
    ezMongo && ezMongo.close(callback);
}

exports.testCollection = function(test) {

    test.expect(1);

    na.runTest(test, {
        col1: [function(next) {
            ezMongo.collection('col1', next);
        }],
        assertResults: ['col1', function(next, results) {
            test.equals('col1', results.col1.collectionName);
            next();
        }]
    });
};

exports.testFindOne = function(test) {

    test.expect(8);

    na.runTest(test, {
        useId: [function(next) {
            EzMongo.findOne('col1', 'docB', ['num','char'], next);
        }],
        noFields: [function(next) {
            EzMongo.findOne('col1', 'docB', next);
        }],
        useObj: [function(next) {
            EzMongo.findOne('col1', {char: 'A'}, ['num'], next);
        }],
        manyChoices: [function(next) {
            EzMongo.findOne('col1', {num: {$gte: 2}}, ['char'], next);
        }],
        assertResults: ['useId','noFields','useObj','manyChoices',function(next, results) {
            test.equals(2, results.useId.num);
            test.equals('B', results.useId.char);
            test.equals(2, results.noFields.num);
            test.equals('B', results.noFields.char);
            test.equals(1, results.useObj.num);
            test.ok(!results.useObj.char);
            test.ok(!results.manyChoices.num);
            test.ok(results.manyChoices.char !== 'A');
            next();
        }]
    });
};

exports.testFindMultiple = function(test) {

    test.expect(9);

    na.runTest(test, {
        useIds: [function(next) {
            ezMongo.findMultiple('col1', ['docA','docB'], ['num','char'], next);
        }],
        useObj: [function(next) {
            ezMongo.findMultiple('col1', {num: {$gte: 2}}, ['num','char'], next);
        }],
        sort: [function(next) {
            ezMongo.findMultiple('col1', ['docA','docB','docC'], ['num'], [['num','asc']], next);
        }],
        limit: [function(next) {
            ezMongo.findMultiple('col1', ['docA','docB','docC'], ['char'], [['num','desc']], 2, next);
        }],
        skip: [function(next) {
            ezMongo.findMultiple('col1', ['docA','docB','docC'], ['char'], [['num','desc']], 2, 1, next);
        }],
        assertResults: ['useIds','useObj','sort','limit','skip',function(next, results) {

            test.equal(2, results.useIds.length);
            test.ok(results.useIds.some(function(el) {
                return el.num === 1 && el.char === 'A';
            }));
            test.ok(results.useIds.some(function(el) {
                return el.num === 2 && el.char === 'B';
            }));

            test.equal(2, results.useObj.length);
            test.ok(results.useObj.some(function(el) {
                return el.num === 2 && el.char === 'B';
            }));
            test.ok(results.useObj.some(function(el) {
                return el.num === 3 && el.char === 'C';
            }));

            test.deepEqual([{_id: 'docA', num: 1}, {_id: 'docB', num: 2}, {_id: 'docC', num: 3}], results.sort);
            test.deepEqual([{_id: 'docC', char: 'C'}, {_id: 'docB', char: 'B'}], results.limit);
            test.deepEqual([{_id: 'docB', char: 'B'}, {_id: 'docA', char: 'A'}], results.skip);

            next();
        }]
    });
};

exports.testModifyOne = function(test) {

    test.expect(5);

    na.runTest(test, {
        useId: [function(next) {
            ezMongo.modifyOne('col1','docB',{$set: {num: 4000}}, next);
        }],
        reloadDocB: ['useId', function(next) {
            ezMongo.modifyOne('col1','docB', next);
        }],
        useObject: [function(next) {
            ezMongo.modifyOne('col2',{num: 88},{$set: {char: 'A'}}, next);
        }],
        reloadDocY: ['useObject', function(next) {
            ezMongo.modifyOne('col2','docY', next);
        }],
        nonExistent: [function(next) {
            ezMongo.modifyOne('col1','bad_id',{$set: {char: 'A'}}, next);
        }],
        assertResults: ['reloadDocB','reloadDocY','nonExistent',function(next, results) {
            var docB = results.reloadDocB;
            var docY = results.reloadDocY;

            test.equals(1, results.useId);
            test.equals(4000, docB.num);
            test.equals(1, results.useObject);
            test.equals('A', docY.char);
            test.equals(0, results.nonExistent);

            next();
        }]
    });
};

exports.testModifyMultiple = function(test) {

    test.expect(9);

    na.runTest(test, {
        useIds: [function(next) {
            ezMongo.modifyOne('col1',['docA','docB'],{$set: {num: 4000}}, next);
        }],
        reloadCol1: ['useIds', function(next) {
            ezMongo.modifyOne('col1',{}, null, [['_id','asc']], next);
        }],
        useObject: [function(next) {
            ezMongo.modifyOne('col2',{num: {$gte: 88}},{$set: {char: 'A'}}, next);
        }],
        reloadCol2: ['useObject', function(next) {
            ezMongo.modifyOne('col2', {}, null, [['_id','asc']], next);
        }],
        nonExistent: [function(next) {
            ezMongo.modifyOne('col2',{badField: 'notHere'},{$set: {char: 'A'}}, next);
        }],
        assertResults: ['reloadCol1', 'reloadCol2', 'nonExistent', function(next, results) {
            var col1 = results.reloadCol1;
            var col2 = results.reloadCol2;

            test.equals(2, results.useIds);
            test.equals(4000, col1[0].num);
            test.equals(4000, col1[1].num);
            test.equals(3, col1[2].num);

            test.equals(2, results.useObject);
            test.equals('X', col2[0].char);
            test.equals('A', col2[1].char);
            test.equals('A', col2[2].char);

            test.equals(0, results.nonExistent);

            next();
        }]
    });
};

exports.testInsert = function(test) {

    test.expect(6);

    var soloData = {_id: 'docF', num: 6, char: 'F'};
    var multiData =  [{_id: 'docH', num: -1, char: 'H'},
        {_id: 'docI', num: -2, char: 'I'}];

    na.runTest(test, {
        insertOne: [function(next) {
            ezMongo.insert('col1', soloData, next);
        }],
        reloadCol1: ['insertOne', function(next) {
            ezMongo.insert('col1',{}, null, [['_id','asc']], next);
        }],
        insertMultiple: [function(next) {
            ezMongo.insert('col2', multiData, next);
        }],
        reloadCol2: ['insertMultiple', function(next) {
            ezMongo.insert('col2', {}, null, [['_id','asc']], next);
        }],
        assertResults: ['reloadCol1','reloadCol2',function(next, results) {
            var col1 = results.reloadCol1;
            var col2 = results.reloadCol2;

            test.equals(soloData._id, results.insertOne);
            test.deepEqual(soloData, col1[3]);

            test.deepEqual(multiData, results.insertMultiple);
            test.equals(5, col2.length);
            test.deepEqual(multiData[0], col2[0]);
            test.deepEqual(multiData[1], col2[1]);

            next();
        }]
    });
};