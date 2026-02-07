function music(){
  const musiconoroff = document.getElementById('music-onoroff');
  const musicoffline = document.getElementById('music-off-line');
  const themusic = document.getElementById('bgm');

  if (themusic.paused) {
    themusic.play()
      .then(() => {
        musicoffline.classList.add("playmusic");
        musiconoroff.style.display = "none";
      })
      .catch(err => {
        console.warn("音樂播放被瀏覽器拒絕：", err);
        alert("瀏覽器阻擋了自動播放，請再點一次「是」開啟音樂");
      });
  } else {
    themusic.pause();
    musicoffline.classList.remove("playmusic");
  }
}


function JumpTo(id) {
    var jumpto = document.getElementById(id);
    jumpto.scrollIntoView({ block: 'start' , behavior: 'smooth' });
}

//
function reveal(){
    var reveals = document.querySelectorAll(".countdown-area-box>div,.half-circle,.traffic-map,.time,.invite-content p,.invite-content h1,.introbox p,.introbox h1,.introline,.sibling-bubble")
    for (var i = 0; i < reveals.length; i++){
        var windowHeight = window.innerHeight;
        var elementTop = reveals[i].getBoundingClientRect().top;
        var elementVisible = 150;
        if (elementTop < windowHeight - elementVisible) {
            reveals[i].classList.add("active");
        } else {
            reveals[i].classList.remove("active");
        }
    }
}
window.addEventListener("scroll",reveal)
reveal();
//
function revealbg2(){
    var revealbg2 = document.querySelectorAll(".schedule")
    for (var i = 0; i < revealbg2.length; i++){
        var windowHeight = window.innerHeight;
        var elementTop = revealbg2[i].getBoundingClientRect().top;
        var elementVisible = 0;
        if (elementTop < windowHeight - elementVisible) {
            document.getElementById("secondbg").style.display = "block";
        } else {
            document.getElementById("secondbg").style.display = "none";
        }
    }
}
window.addEventListener("scroll",revealbg2)
  
function revealbg3(){
    var revealbg3 = document.querySelectorAll(".RSVP")
    for (var i = 0; i < revealbg3.length; i++){
        var windowHeight = window.innerHeight;
        var elementTop = revealbg3[i].getBoundingClientRect().top;
        var elementVisible = 0;
        if (elementTop < windowHeight - elementVisible) {
            document.getElementById("thirdbg").style.display = "block";
        } else {
            document.getElementById("thirdbg").style.display = "none";
        }
    }
}
window.addEventListener("scroll",revealbg3)

function showgallery(id){
    document.getElementById(id).style.display = "block";
    document.getElementById("gallery").style.display = "block";
    document.getElementById("closebutton").style.display = "block";

    if ( document.getElementById('video').style.display == "block" ) {
        let musicoffline = document.getElementById('music-off-line'),
        themusic = document.querySelector("audio");
        
        themusic.pause();
        musicoffline.classList.remove("playmusic");
    };
}

function closegallery(){
    document.getElementById("gallery").style.display = "none";
    document.getElementById("closebutton").style.display = "none";
    document.getElementById("photo-gallery").style.display = "none";
    document.getElementById("video").style.display = "none";

    const iframeVideos = document.querySelectorAll("iframe");
    if (iframeVideos.length > 0) {
      iframeVideos.forEach((iframe) => {
        if (iframe.contentWindow) {
          if (iframe.src.startsWith("https://player.vimeo.com/")) {
            iframe.contentWindow.postMessage('{"method":"pause"}', "*");
          }
        }
      });
    };
}

//form
function AttendFunction(id){
    let Form1 = document.getElementById(id),
    notAttend = Form1.querySelectorAll(".not-attend"),
    ATTEND = Form1["ATTEND"],
    ADULT = Form1["ADULT"],
    KID = Form1["KID"];
    // VEGAN = Form1["VEGAN"];


    if ( ATTEND.value == "出席" || ATTEND.value == "" ){
        ADULT.value = "";
        KID.value = "";
        // VEGAN.value = "";
    
        Form1.querySelector(".not-attend-checked").removeAttribute("checked","");
    
        notAttend.forEach(noreply => {
            noreply.style.display = "block";
        });
    } else {
        ADULT.value = "0";
        KID.value = "0";
        // VEGAN.value = "0";
    
        Form1.querySelector(".not-attend-checked").setAttribute("checked","");
    
        const notAttend = Form1.querySelectorAll(".not-attend");
    
        notAttend.forEach(noreply => {
            noreply.style.display = "none";
        });
    };
}

function InvitationFunction(){
    let Form1 = document.forms['form1'],
    INVITATION = Form1["INVITATION"],
    ADDRESS = Form1["ADDRESS"];

    if ( INVITATION.value == "需要" || INVITATION.value == "" ){  
        ADDRESS.value = "";
        ADDRESS.disabled = false;
    } else {
        ADDRESS.value = "X";
        ADDRESS.disabled = true;
    };
}

function submitform1(){
    let Form1 = document.getElementById('form1'),
    NAME = Form1["NAME"].value,
    EMAIL = Form1["EMAIL"].value,
    ATTEND = Form1["ATTEND"].value,
    ADULT = Form1["ADULT"].value,
    KID = Form1["KID"].value,
    PHONE = Form1["PHONE"].value,
    TRAFFIC = Form1["TRAFFIC"].value,
    // VEGAN = Form1["VEGAN"].value,
    //INVITATION = Form1["INVITATION"].value,
    //ADDRESS = Form1["ADDRESS"].value,
    MESSAGE = Form1["MESSAGE"].value;

    if(NAME === "" ){
        document.getElementById('Name').scrollIntoView({ block: 'center' , behavior: 'smooth' });
        alert('請填寫姓名');
    } else if( ATTEND === "出席" &&  ADULT === "" ){
        document.getElementById('Adult').scrollIntoView({ block: 'center' , behavior: 'smooth' });
        alert('請回答大人人數');
    } else if( ATTEND === "出席" && KID === "" ){
        document.getElementById('Kid').scrollIntoView({ block: 'center' , behavior: 'smooth' });
        alert('請回答小孩人數');
    } else if( ATTEND === "出席" && PHONE === "" ){
        document.getElementById('Phone').scrollIntoView({ block: 'center' , behavior: 'smooth' });
        alert('請填寫聯絡電話');
    } else if( TRAFFIC === "" ){
        document.getElementById('Traffic').scrollIntoView({ block: 'center' , behavior: 'smooth' });
        alert('請問預計要如何抵達');
    
    // } else if( VEGAN === "" ){
    //     document.getElementById('Vegan').scrollIntoView({ block: 'center' , behavior: 'smooth' });
    //     alert('請問是否有素食需求');
    // } else if( INVITATION === "" ){
    //     document.getElementById('Invitation').scrollIntoView({ block: 'center' , behavior: 'smooth' });
    //     alert('請問是否需要紙本喜帖');
    // } else if( ADDRESS === "" ){
    //     document.getElementById('Address').scrollIntoView({ block: 'center' , behavior: 'smooth' });
    //     alert('請留下喜帖收件地址');
    } else if (ATTEND === "出席" && EMAIL === "") {
        document.getElementById('Email').scrollIntoView({ block: 'center' , behavior: 'smooth' });
        alert('請填寫 Email');
    } else if (ATTEND === "出席" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(EMAIL)) {
        document.getElementById('Email').scrollIntoView({ block: 'center' , behavior: 'smooth' });
        alert('Email 格式不正確');
    }else{
        function addZero(i) {
            if (i < 10) {i = "0" + i}
            return i;
        }
        
        const today = new Date(),
        year = today.getFullYear(),
        month = today.getMonth()+1,
        day = today.getDate(),
        h = addZero(today.getHours()),
        m = addZero(today.getMinutes()),
        s = addZero(today.getSeconds()),
        time = h + ":" + m + ":" + s,
        SUBMITTIME = year+"/"+month+"/"+day+" "+time;

        document.getElementById('loading').style.display = "block";
        
        $.ajax({
          type: "POST",
          url: "https://script.google.com/macros/s/AKfycbxPq4ys7M8TJXYp_yZ3TXUJRKi4aeWeFKuQ1wLGG_kWGQJVngh5_Bx0UM6sKN5xTSwK/exec",
          data: {
            "SUBMITTIME": SUBMITTIME, 
            "NAME": NAME, 
            "ATTEND": ATTEND, 
            "ADULT": ADULT, 
            "KID": KID,
            "PHONE": PHONE,
            "TRAFFIC": TRAFFIC, 
            "EMAIL": EMAIL,
            "MESSAGE": MESSAGE,
          },
          contentType: "application/x-www-form-urlencoded",
          dataType: "JSON",
          success: function(response){
            console.log("後端回傳成功內容:", response);
            if (response.success) {
              submitform();
            } else {
              alert("傳送異常，請再試一次");
            }
          },
          error: function(xhr, status){
            var errorMsg = xhr.status;
            console.error("狀態碼:", errorMsg);
            if (xhr.status === 200) {
                submitform();
            } else {
                var errorMsg = xhr.status;
                if(errorMsg === 0){
                    alert('網路異常！請檢查連線後再試一次');
                } else{
                    alert ('傳送失敗 (' + xhr.status + ')');
                }
            }
          },
          complete: function(){
            document.getElementById('loading').style.display = "none";
          }
        });
    }
}  



function submitform(){
    const submitsuccess = document.getElementById('submit-success');
    submitsuccess.style.display = "flex";
}

function submitok(){
    window.location.reload();
}

//
var TheDay = new Date("June 6, 2026 12:00:00").getTime();

var x = setInterval(function() {

  var now = new Date().getTime();
  var distance = TheDay - now;
  var days = Math.floor(distance / (1000 * 60 * 60 * 24));
  var hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  var minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
  var seconds = Math.floor((distance % (1000 * 60)) / 1000);
    
  document.getElementById("days").innerHTML = days;
  document.getElementById("hours").innerHTML = hours;
  document.getElementById("mins").innerHTML = minutes;
  document.getElementById("secs").innerHTML = seconds;
  
  document.getElementById("countdown").innerHTML = "距離婚禮還剩 " + days + " 天<br>" + hours + " 小時 "
  + minutes + " 分鐘 " + seconds + " 秒<br>讓我們一起期待吧！";
    
  if (distance < 0) {
    clearInterval(x);
    document.getElementById("countdown-area").innerHTML = "<h1>Countdown</h1><br>IT'S TIME TO CELEBRATE !";
    document.getElementById("countdown").innerHTML = "LET'S CELEBRATE !";
  }
}, 1000);


const eventConfig = {
    title: "Wedding: Ching & Sin",
    description: "我們結婚了！\n邀請您前往美國度假村 Club63 與我們一起慶祝。\n婚宴細節請參考： https://hchs.site/",
    location: "美國度假村 Club63, 台北市士林區凱旋路61巷2弄2號",
    // Start: June 6, 2026, 10:30 AM (Taipei Time is UTC+8)
    // Converted to UTC: June 6, 2026, 02:30 AM
    startUTC: "20260606T023000Z",
    // End: June 6, 2026, 03:30 PM (Taipei Time is UTC+8)
    // Converted to UTC: June 6, 2026, 07:30 AM
    endUTC: "20260606T073000Z"
};

/**
 * Open Google Calendar Add Event URL
 */
function addToGoogleCalendar() {
    const baseUrl = "https://calendar.google.com/calendar/render?action=TEMPLATE";
    const text = `&text=${encodeURIComponent(eventConfig.title)}`;
    const dates = `&dates=${eventConfig.startUTC}/${eventConfig.endUTC}`;
    const details = `&details=${encodeURIComponent(eventConfig.description)}`;
    const location = `&location=${encodeURIComponent(eventConfig.location)}`;
    
    const fullUrl = `${baseUrl}${text}${dates}${details}${location}`;
    window.open(fullUrl, '_blank');
}

/**
 * Generate and download ICS file for Apple/Outlook
 */
function downloadICS() {
    // Format current time for DTSTAMP
    const now = new Date();
    const dtStamp = now.toISOString().replace(/[-:]|\.\d{3}/g, '');

    // Construct ICS file content
    const icsContent = `
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//ChingAndSin//Wedding//EN
BEGIN:VEVENT
UID:${Date.now()}@chingandsin.wedding
DTSTAMP:${dtStamp}
DTSTART:${eventConfig.startUTC}
DTEND:${eventConfig.endUTC}
SUMMARY:${eventConfig.title}
DESCRIPTION:${eventConfig.description.replace(/\n/g, '\\n')}
LOCATION:${eventConfig.location}
END:VEVENT
END:VCALENDAR`.trim();

    // Create blob and download link
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'Wedding_Ching_Sin.ics');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Bind the click event for the ICS button after DOM loads
document.addEventListener("DOMContentLoaded", function() {
    const icsBtn = document.getElementById("ics-download-btn");
    if (icsBtn) {
        icsBtn.addEventListener("click", downloadICS);
    }
});

// Expose functions to window for onclick events
window.music = music;
window.JumpTo = JumpTo;
window.showgallery = showgallery;
window.closegallery = closegallery;
window.AttendFunction = AttendFunction;
window.submitform1 = submitform1;
window.submitok = submitok;
window.addToGoogleCalendar = addToGoogleCalendar;
window.downloadICS = downloadICS;
