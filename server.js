var express = require('express');
var app = express();
var session = require('express-session');
var http = require('http');
var MySQLStore = require('express-mysql-session')(session);
var sha256 = require('sha256');
var path = require('path');
var bodyParser = require('body-parser');
var fs = require('fs');
var multer = require('multer');

var _storage = multer.diskStorage({
  destination: function (req, file, cb) {
    var ext = path.extname(file.originalname);
    var filename = path.basename(file.originalname, ext);
    if((ext==='.mp4') || (ext==='.wmv') || (ext==='.avi')){
      cb(null, 'public/uploads/video');
    }
    else if((ext==='.mp3') || (ext==='.wav') || (ext==='.flac') || (ext==='.wma') || (ext==='.mid')){
      cb(null, 'public/uploads/audio');
    }
    else {
      cb(null, 'public/uploads/etc');
    }
  },
  filename: function (req, file, cb) {
    //if(파일이 이미 존재한다면)
    //cb(null, file.originalname에 동일이름의 파일 중에 가장 큰 숫자를 끝에 붙인다)
    //else
      var ext = path.extname(file.originalname);
      cb(null, file.originalname+'-'+Date.now()+ext);
  }
});

var upload = multer({ storage: _storage })

var csv = require('fast-csv');
var csvParser = require('csv-parse');

app.use(bodyParser.urlencoded({ extended: false }));
app.locals.pretty= true;

//정적파일 세팅
app.use(express.static(path.join(__dirname+'/public')));
app.use('/video_list/:v_no', express.static('public/uploads/video'));
app.use('/audio_list/:a_no', express.static('public/uploads/audio'));

app.use('/member_edit/:userid', express.static('public'));
app.use('/video_edit/:v_no', express.static('public'));
app.use('/audio_edit/:a_no', express.static('public'));
app.use('/product_edit/:serialno', express.static('public'));
app.use('/video/:v_category', express.static('public'));
app.use('/audio/:a_category', express.static('public'));

app.set('view engine','jade');
app.set('views', __dirname+'/views');




/*mySQL DB 연동*/
var mysql = require('mysql');
var conn = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '1q1q1q1q',
  database: 'smartbed'
});
conn.connect(err => { if (err) throw new Error(err)});


/*관리자 로그인 세션*/
app.use(session({
  secret: '1231231asfswa23',
  resave: false,
  saveUninitialized: true,
   store: new MySQLStore({
     host: 'localhost',
     port: 3306,
     user: 'root',
     password: '1q1q1q1q',
     database: 'smartbed'
   })
}));



/*관리자 로그아웃*/
app.get('/logout', function(req, res){
  delete req.session.displayName;
  req.session.save(function(){
      res.redirect('/');
  })
});


/*관리자 로그인*/
app.get('/', function(req, res){
  if(req.session.displayName){
    res.send(`<script>location.href='/main'</script>`)
  } else {
    res.render('index');
  }
});
app.post('/', function(req, res){

  var admin =
  {
    aid : 'admin',
    apw : '4fbac567c0e899b0e5657025f6fad0991dd108c01373779e4c99732d2571f749',
    salt : '&^@&*^#*&*!sdfg324',
    displayName: '관리자'
  };

  var adminid = req.body.adminid;
  var adminpw = req.body.adminpw;

  if(adminid === admin.aid && sha256(adminpw+admin.salt) === admin.apw){

    req.session.displayName = admin.displayName;
    req.session.save(function(){
        res.redirect('/main');
    });

  } else {
    res.send(`<script>
      alert('아이디 또는 비밀번호를 확인해주세요.');
      location.href='/';
      </script>`)
  }
});


/*관리자 로그인 후 메인화면*/
app.get('/main', function(req, res){
  if(req.session.displayName){  //로그인 성공
    res.render('main', {loginName:req.session.displayName });

  } else {  //로그인 실패
    res.send(`
      <p>Welcome</p>
      <a href="/">Login</a>
      `);
  }
});



/*회원정보 조회*/
app.get('/member_list', function(req, res){
  var sql = 'SELECT userid, serialno, name, m_date FROM member';

  if(req.session.displayName){
    conn.query(sql, function(err, rows, fields){
      if(err){
        console.log(err);
      } else {
        res.render('member', {items:rows, loginName:req.session.displayName });
      }
    });

  } else {
    res.send(`<script>alert('로그인 해주세요'); location.href='/';</script>`)
  }
});

/*사용자 로그인(안드로이드 통신)*/
app.post('/member_list', function(req, res){
  var id = req.body.id;
  var pw = req.body.pw;


  console.log('ID: '+id+'        PW: '+pw);//전송받은 id,pw출력

  var sql = 'SELECT * FROM member WHERE userid=?';
  conn.query(sql, [id], function(err, rows, fields){

    if(rows.length===0){  //해당 아이디가 없으면
        console.log("해당 아이디가 없습니다.");
        res.json({result:'fail',
                  check: ''
      });
      }
    else {  //해당 아이디가 있을 때 비밀번호 체크
        var sql = 'SELECT * FROM member WHERE userid=? AND password=PASSWORD(?)';
        conn.query(sql, [id, pw], function(err, rows, fields){
          if(rows.length===0){  //id, pw 불일치
            console.log("비밀번호를 확인해주세요.");
            res.json({result:'fail2',
            check: ''
          });
          } else {  //로그인 성공


            //로그인 성공시 시리얼인증여부 확인
            var sql = 'SELECT * FROM member WHERE userid=? AND serialno="000000"';
            conn.query(sql, [id], function(err, rows, fields){
              if(rows.length === 0) { //시리얼 인증을 안했을 경우
                console.log("로그인 성공, 시리얼인증O");
                res.json({result: 'success', check:'success1'});
              } else {    //시리얼 인증을 했을 경우
                console.log("로그인 성공, 시리얼인증X");
                res.json({result:'success', check:'fail1'});
              }
            });


          }
        });
    }
  });
});




/*회원가입 (안드로이드 통신)*/
app.post('/register', function(req, res){
  var id = req.body.id;
  var name = req.body.name;
  var pw = req.body.pw;

  console.log('전송된값 id: '+id+"    name: "+name+"    pw:"+pw);
  if(id && name && pw){ //모두 입력했을 경우.
    var sql = 'SELECT * FROM member WHERE userid=?';  //id중복 체크
    conn.query(sql, [id], function(err, rows, fields){

      if(rows.length===0){  //id 중복X
        console.log(id+': 아이디 유효');

        var sql = 'INSERT INTO member(userid, serialno, name, password) VALUES(?,"000000", ?, PASSWORD(?))';
        conn.query(sql,[id, name, pw], function(err, rows, fields){
          if(err){
            console.log("DB저장 실패");
            console.log(err);
          }else{
            console.log("id: "+id+'     name: '+name+'    PW: '+pw+'  ----회원가입 성공');
            res.json({result:'success'});
          }
        });//query
      }//if

      else {  //id 중복O
      console.log(id+ ": 이미 사용중인 아이디입니다.");
       res.json({result:"fail"});
      }
    }); //query


  }//if
  else{ //다 입력안했을 떄

    console.log('모두 입력해주세요.');
    res.json({result:'fail2'});
  }
});


/*시리얼번호 인증*/
app.post('/serial', function(req, res){
  var serial = req.body.serial;
  var id = req.body.id;


  if(id && serial){ //아이디, 시리얼 다 입력했을 때 ----> 시리얼번호가 유효한지 확인
    console.log(id);
    var sql = 'SELECT * FROM product WHERE ? IN (product.serialno) AND certificate=0 AND serialno NOT IN ("000000")';
    conn.query(sql, [serial], function(err, rows, fields){
      if(rows.length === 0){  //시리얼번호가 유효하지 않을때(사용중이거나, 리스트에 없을때, 000000이 아닐때)
        console.log('SN: '+serial+'유효하지 않습니다.');
        res.json({result: 'fail'});
      } else {  //시리얼번호가 유효할 때(사용중X, 리스트에 있을때) ---> 인증처리
        var sql = 'UPDATE member, product SET member.serialno=?, product.certificate=1 WHERE member.userid=? AND  product.serialno=?';
        conn.query(sql, [serial, id, serial], function(err, rows, fields){  //시리얼 인증처리
          console.log('SN: '+serial+'시리얼인증성공');

          res.json({result: 'success'});
        });
      }
    });

  } else {  //입력 다 안했을 때
    console.log('모두 입력하세요');
    res.json({result: 'fail1'});
  }

});



/*동영상 조회*/
app.get(['/video_list', '/video'], function(req, res){
  var sql = 'SELECT v_no, v_title, v_category, v_path FROM video';

  if(req.session.displayName){
    conn.query(sql, function(err, rows, fields){
      if(err){
        console.log(err);
      } else {
        res.render('video', {items:rows, loginName:req.session.displayName });
      }
    });

  } else {
    res.send(`<script>alert('로그인 해주세요'); location.href='/';</script>`)
  }
});
/*동영상 안드로이드 통신*/
app.post('/video', function(req, res){

  var msg = req.body.msg; //안드로이드에서 선택한 카테고리 변수
  console.log('선택한 카테고리: '+msg);
  switch(msg){
    case 'cartoon':
      var sql = 'SELECT v_no, v_title FROM video WHERE v_category="만화"';
      conn.query(sql, function(err, rows,fields){
        if(err){
          console.log(err);
        } else {
          //rows = JSON.stringify(rows);
          //rows = JSON.parse(rows);
          console.log(rows);
          res.json(rows);
        }
      });
      break;

    case 'study':
      var sql = 'SELECT v_no, v_title FROM video WHERE v_category="교육영상"';
      conn.query(sql, function(err, rows,fields){
        if(err){
          console.log(err);
        } else {
          rows = JSON.stringify(rows);
          // rows = JSON.parse(rows);
          console.log(rows);
          res.json(rows);
        }

      });
      break;
    case 'etc':
      var sql = 'SELECT v_no, v_title FROM video WHERE v_category="기타"';
      conn.query(sql, function(err, rows,fields){
        if(err){
          console.log(err);
        } else {
          rows = JSON.stringify(rows);
          // rows = JSON.parse(rows);
          console.log(rows);
          res.json(rows);
        }
      });
      break;

    default:
      break;
  } //switch

});
app.get('/andVideo', function(req, res){
  // var category = req.body.category;
  // if(!category){
  //   var sql = 'SELECT v_no, v_title FROM video WHERE v_category="기타"';
  //   conn.query(sql, function(err, rows, fields){
  //     rows = JSON.stringify(rows);
  //     // rows = JSON.parse(rows);
  //     res.json(rows);
  //     console.log(rows);
  //   });
  // }
  var video_play = 27;
  var vUrl = host+':'+port+'/video_list/'+video_play;
  console.log(vUrl);
});

/*동영상 카테고리별 조회*/
app.get('/video/:v_category', function(req, res){
  var sql = 'SELECT v_no, v_title, v_category, v_path FROM video WHERE v_category=?';
  var v_category = req.params.v_category;

  if(v_category === 'cartoon') v_category = '만화';
  else if(v_category === 'study') v_category = '교육영상';
  else if(v_category === 'etc') v_category = '기타';

  if(req.session.displayName){
    conn.query(sql,[v_category], function(err, rows, fields){
      if(err){
        console.log(err);
      } else {
        res.render('video', {items:rows, loginName:req.session.displayName });
      }
    });

  } else {
    res.send(`<script>alert('로그인 해주세요'); location.href='/';</script>`)
  }
});


/*오디오 조회*/
app.get(['/audio_list', '/audio'], function(req, res){
  if(req.session.displayName){
    var sql = 'SELECT a_no, a_title, a_category, a_path FROM audio';
    conn.query(sql, function(err, rows, fields){
      if(err){
        console.log(err);
      } else {
        res.render('audio', {items:rows, loginName:req.session.displayName });
      }
    });
  } else {
    res.send(`<script>alert('로그인 해주세요'); location.href='/';</script>`);
  }
});

/*오디오 안드로이드 통신*/
app.post('/audio', function(req, res){

  var msg = req.body.msg; //안드로이드에서 선택한 카테고리 변수
  console.log('선택한 카테고리: '+msg);
  switch(msg){
    case 'whitesound':
      var sql = 'SELECT a_no, a_title FROM audio WHERE a_category="백색소음"';
      conn.query(sql, function(err, rows,fields){
        if(err){
          console.log(err);
        } else {
          rows = JSON.stringify(rows);
          // rows = JSON.parse(rows);
          console.log(rows);
          res.json(rows);
        }
      });
      break;

    case 'childsong':
      var sql = 'SELECT a_no, a_title FROM audio WHERE a_category="동요"';
      conn.query(sql, function(err, rows,fields){
        if(err){
          console.log(err);
        } else {
          rows = JSON.stringify(rows);
          // rows = JSON.parse(rows);
          console.log(rows);
          res.json(rows);
        }

      });
      break;
    case 'classic':
      var sql = 'SELECT a_no, a_title FROM audio WHERE a_category="클래식"';
      conn.query(sql, function(err, rows,fields){
        if(err){
          console.log(err);
        } else {
          rows = JSON.stringify(rows);
          // rows = JSON.parse(rows);
          console.log(rows);
          res.json(rows);
        }
      });
      break;
    case 'etc':
      var sql = 'SELECT a_no, a_title FROM audio WHERE a_category="기타"';
      conn.query(sql, function(err, rows, fields){
        if(err){
          console.log(err);
        } else {
          rows = JSON.stringify(rows);
          console.log(rows);
          res.json(rows);
        }
      });
      break;

    default:
      break;
  } //switch

});



/*오디오 카테고리별 조회*/
app.get('/audio/:a_category', function(req, res){
  var sql = 'SELECT a_no, a_title, a_category, a_path FROM audio WHERE a_category=?';
  var a_category = req.params.a_category;

  if(a_category === 'whitesound') a_category = '백색소음';
  else if(a_category === 'childsong') a_category = '동요';
  else if(a_category === 'classic') a_category = '클래식';
  else if(a_category === 'etc') a_category = '기타';

  if(req.session.displayName){
    conn.query(sql,[a_category], function(err, rows, fields){
      if(err){
        console.log(err);
      } else {
        res.render('audio', {items:rows, loginName:req.session.displayName });
      }
    });

  } else {
    res.send(`<script>alert('로그인 해주세요'); location.href='/';</script>`)
  }
});


/*제품정보 조회*/
app.get('/product_list', function(req, res){
  if(req.session.displayName){
    var sql = 'SELECT serialno, name, p_date, certificate FROM product';
    conn.query(sql, function(err, rows, fields){
      if(err){
        console.log(err);
      } else {
        res.render('product', {items:rows, loginName:req.session.displayName });
      }
    });
  } else {
    res.send(`<script>alert('로그인 해주세요'); location.href='/';</script>`);
  }
});

/*csv 파일 양식 다운로드*/
app.get('/product_add_csv', function(req, res){
  res.render('product_add_csv', {loginName:req.session.displayName });
});
app.get('/fileDown', function(req, res){
  var filepath = __dirname+'/product.csv';
  res.download(filepath);
});

/*CSV 파일로 추가*/
app.post('/product_add_csv', function(req, res){

  var stream = fs.createReadStream('product.csv', {encoding:'utf-8'});
  csv
    .fromStream(stream, {headers: true, ignoreEmpty: true})
    .on('data', function(data){
      console.log(data);
      var serialno = data.serialno;
      var name = data.name;
      var p_date = data.p_date;
      var certificate = data.certificate;
      var sql = 'INSERT INTO product(serialno, name, p_date, certificate) VALUES(?,?,?,?)';

      conn.query(sql, [serialno, name, p_date, certificate], function(err, rows, fields){
        if(err){
          console.log(err);
          var output = `<script>alert('유효하지 않은 값입니다.');</script>`;
          res.send(output);
        }

      });
    })
    .on('end', function(data){
      console.log("Read Finished");
      res.redirect('/product_list');
    });
});


/*회원 추가*/
app.get('/member_add', function(req, res){
  if(req.session.displayName){
    res.render('member_add', {loginName:req.session.displayName });
  } else {
    res.send(`<script>alert('로그인 해주세요'); location.href='/';</script>`);
  }
});
app.post('/member_add', function(req, res){
  var userid = req.body.userid;
  var serialno = req.body.serialno;
  var name = req.body.name;
  var password = req.body.password;

  var sql = 'INSERT INTO member(userid, serialno, name, password) VALUES(?,?,?,PASSWORD(?))';

  //'INSERT INTO member (?,?,?,?) SELECT * FROM p.serialno FROM product p where p.certificate = 0 ;';
  // UPDATE product, member SET certificate=1 WHERE member.serialno IN (product.serialno);
  conn.query(sql, [userid, serialno, name, password], function(err, rows, fields){
    if(err){
      console.log(err);
      res.status(500).send(`<script>alert('유효한 값이 아닙니다');location.href='/member_add';</script>`);
    } else {
      var sql = 'UPDATE product, member SET certificate=1 WHERE member.serialno IN (product.serialno) AND member.serialno NOT IN ("000000")';
      conn.query(sql, function(err, rows, fields){
        var sql = 'UPDATE product, '
        res.redirect('/member_list');
      });
    }
  });

});


/*제품 정보 추가*/
app.get('/product_add', function(req, res){
  if(req.session.displayName){
    res.render('product_add', {loginName:req.session.displayName });
  } else {
    res.send(`<script>alert('로그인 해주세요'); location.href='/';</script>`)
  }
});
app.post('/product_add', function(req, res){
  var serialno = req.body.serialno;
  var name = req.body.name;
  var p_date = req.body.p_date;
  var certificate = req.body.certificate;
  var sql = 'INSERT INTO product (serialno, name, p_date) VALUES(?, ?, ?)';
  conn.query(sql, [serialno, name, p_date], function(err, rows, fields){
    if(err){
      console.log(err);
      res.status(500).send(`<script>alert('유효한 값이 아닙니다');location.href='/product_add';</script>`);
    } else {
      res.redirect('/product_list');
    }
  });

});

/*동영상 추가*/
app.get('/video_add', function(req, res){
  res.render('video_add', {loginName:req.session.displayName});
});

app.post('/video_add', upload.single('v_path'), function(req, res){
  var v_path = req.file.filename;
  var v_title = req.body.v_title;
  var v_category = req.body.v_category;
  var ext = path.extname(req.file.filename);

  if (!(ext === '.mp4' || ext === '.wmv' || ext === '.avi')){
    var output = `<script>alert('동영상 파일만 업로드 가능합니다.'); location.href='/video_add';</script>`;
    res.send(output);
  }
  else {
    var sql = 'INSERT INTO video (v_title, v_category, v_path) VALUES (?, ?, ?)';
    conn.query(sql, [v_title, v_category, v_path], function(err, rows, fields){
      if(err){
        console.log(err);
      } else {
        res.redirect('/video_list');
      }
  });
}
});


/*오디오 추가*/
app.get('/audio_add', function(req, res){
  res.render('audio_add', {loginName:req.session.displayName});
});

app.post('/audio_add', upload.single('a_path'), function(req, res){
  var a_path = req.file.filename;
  var a_title = req.body.a_title;
  var a_category = req.body.a_category;
  var ext = path.extname(req.file.filename);

  if (!(ext === '.mp3' || ext === '.wav') || (ext === '.wma') || (ext==='.flac') || (ext==='.mid')){
    var output = `<script>alert('음악 파일만 업로드 가능합니다.'); location.href='/audio_add';</script>`;
    res.send(output);
  }
  else {
    var sql = 'INSERT INTO audio (a_title, a_category, a_path) VALUES (?, ?, ?)';
    conn.query(sql, [a_title, a_category, a_path], function(err, rows, fields){
      if(err){
        console.log(err);
      } else {
        res.redirect('/audio_list');
      }
  });
}
});





/*회원정보 수정*/
app.get(['/member_edit/:userid'], function(req,res){

  var sql = 'SELECT userid, serialno, name, password FROM member';
  conn.query(sql, function(err, rows, fields){
    var userid = req.params.userid;
    if(userid){
      var sql = 'SELECT * FROM member WHERE userid=?';
      conn.query(sql, [userid], function(err, rows, fields){
        if(err){
          console.log(err);
          res.status(500).send('Interval Server Error');
        } else {
          res.render('member_edit', {items:rows, item:rows[0], loginName:req.session.displayName});
        }
      });
    } else {
      console.log('There is no id.');
      res.status(500).send('Internal Server Error');
    }

  });
});
app.post(['/member_edit/:userid'], function(req, res){
  var userid = req.body.userid;
  var serialno = req.body.serialno;
  var name = req.body.name;
  var password = req.body.password;
  var sql = 'UPDATE member SET serialno=?, name=?, password=PASSWORD(?) WHERE userid=?';

  conn.query(sql, [serialno, name, password, userid], function(err, rows, fields){
    if(err){
      console.log(err);
      res.status(500).send('Interval Server Error');
    } else {
      var sql = 'UPDATE product, member SET certificate=1 WHERE member.serialno IN (product.serialno) AND member.serialno NOT IN ("000000")';
      conn.query(sql, [serialno], function(err, rows, fields){
        res.redirect('/member_list');
      });

    }
  });
});


/*제품정보 수정*/
app.get(['/product_edit/:serialno'], function(req,res){

  var sql = 'SELECT serialno, name, p_date, certificate FROM product';
  conn.query(sql, function(err, rows, fields){
    var serialno = req.params.serialno;
    if(serialno){
      var sql = 'SELECT * FROM product WHERE serialno=?';
      conn.query(sql, [serialno], function(err, rows, fields){
        if(err){
          console.log(err);
          res.status(500).send('Interval Server Error');
        } else {
          res.render('product_edit', {items:rows, item:rows[0], loginName:req.session.displayName});
        }
      });
    } else {
      console.log('There is no id.');
      res.status(500).send('Internal Server Error');
    }

  });
});
app.post(['/product_edit/:serialno'], function(req, res){
  var serialno = req.body.serialno;
  var name = req.body.name;
  var p_date = req.body.p_date;
  var certificate = req.body.certificate;
  var sql = 'UPDATE product SET serialno=?, name=?, p_date=?, certificate=? WHERE serialno=?';

  conn.query(sql, [serialno, name, p_date, certificate, serialno], function(err, rows, fields){
    if(err){
      console.log(err);
      res.status(500).send('Interval Server Error');
    } else {
      res.redirect('/product_list');
    }
  });
});


/*회원 삭제*/
app.get('/member_list/:userid', function(req, res){

  var userid = req.params.userid;
  var sql = 'UPDATE product SET certificate=0 WHERE serialno IN (SELECT serialno FROM member WHERE userid=?)';
  conn.query(sql, [userid], function(err, rows, fields){
    var sql = 'DELETE FROM member WHERE userid=?';
    conn.query(sql, [userid], function(err, rows, fields){
          res.redirect('/member_list');
      });
  });

});


/*제품 삭제*/
app.get('/product_list/:serialno', function(req, res){

  var serialno = req.params.serialno;
    var sql = 'DELETE FROM product WHERE serialno=?';
    conn.query(sql, [serialno], function(err, rows, fields){
        res.redirect('/product_list');
    });
});

/*동영상 삭제*/
app.get('/video_delete/:v_no', function(req, res){
  var v_no = req.params.v_no;
  var sql = 'DELETE FROM video WHERE v_no=?';
  conn.query(sql, [v_no], function(err, rows, fields){
    res.redirect('/video_list');
  });
});

/*오디오 삭제*/
app.get('/audio_delete/:a_no', function(req, res){
  var a_no = req.params.a_no;
  var sql = 'DELETE FROM audio WHERE a_no=?';
  conn.query(sql, [a_no], function(err, rows, fields){
    res.redirect('/audio_list');
  });
});


/*동영상 상세보기*/
app.get('/video_list/:v_no', function(req, res){
  var sql = 'SELECT v_path FROM video WHERE v_no=?';
  var v_no = req.params.v_no;

  conn.query(sql, [v_no], function(err, rows, fields){
    var path = rows[0].v_path;
    var output = `
    <video src="${path}" width="100%" height="100%" controls="controls" autoplay="autoplay" loop="loop">
    </video>`;
    res.send(output);
  });
});


/*오디오 상세보기*/
app.get('/audio_list/:a_no', function(req, res){
  var sql = 'SELECT a_path FROM audio WHERE a_no=?';
  var a_no = req.params.a_no;

  conn.query(sql, [a_no], function(err, rows, fields){
    var path = rows[0].a_path;
    var output = `
    <audio src="${path}" width="100%" height="100%" controls="controls" autoplay="autoplay" loop="loop">
    </audio>`;
    res.send(output);
  });
});

var host = '192.168.0.181';
var port = '4000';

/*라즈베리파이 동영상 URL 통신*/
app.post('/video/play', function(req, res){
  var video_play = req.body.video_play;
  if(video_play){
    var vUrl = host+':'+port+'/video_list/'+video_play;
    console.log(vUrl);
    res.json(vUrl);
  }
});

/*라즈베리파이 오디오 URL 통신*/
app.post('/audio/play', function(req, res){
  var audio_play = req.body.audio_play;
  if(audio_play){
    var aUrl = host+':'+port+'/adio_list/'+audio_play;
    console.log(aUrl);
    res.json(aUrl);
  }
});



app.listen(port, host, function(){
  console.log('connected '+host+':'+port);
});
