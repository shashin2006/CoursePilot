textarea = document.querySelector("#target");
textarea.addEventListener('input', autoResize, false);
function autoResize() {
    this.style.height = 'auto';
    this.style.height = this.scrollHeight + 'px';
}
const say=()=>{
    const val=document.getElementById("costRange").value
    document.getElementById("costDisplay").innerHTML="Cost: ₹"+val;
}

  function saveFreelancerData() {
    const selectedLanguage = document.getElementById("preferredLanguage").value;  // Get selected language

    // Handling profile picture
    const profilePictureInput = document.getElementById("profilePicture");
    let profilePictureName = '';
    if (profilePictureInput.files && profilePictureInput.files[0]) {
      const reader = new FileReader();
      reader.onload = function(e) {
        profilePictureName = e.target.result;  // Base64 image data
        saveData();
      };
      reader.readAsDataURL(profilePictureInput.files[0]);  // Read the file
    } else {
      profilePictureName = '';  // Default if no file selected
      saveData();
    }

    // Function to save freelancer data
    function saveData() {
      const freelancerData = {
        fullName: document.getElementById("fullName").value,
        phone: document.getElementById("phone").value,
        profilePicture: profilePictureName,  // Image as base64
        fieldOfInterest: document.getElementById("fieldOfInterest").value,
        courseName: document.getElementById("course").value,
        skills: document.getElementById("skills").value,
        age: document.getElementById("age").value,
        experienceLevel: document.getElementById("experienceLevel").value,
        costRange: document.getElementById("costRange").value,
        certification: document.getElementById("certification").value,
        duration: document.getElementById("duration").value,
        learningPace: document.getElementById("learningPace").value,
        learningStyle: document.getElementById("learningStyle").value,
        preferredLanguage: selectedLanguage,
        socialLinks: document.getElementById("socialLinks").value,
        bio: document.getElementById("target").value
      };

      // Save data to localStorage
      localStorage.setItem("freelancerData", JSON.stringify(freelancerData));

      // Redirect to profile page
      window.location.href = "profile.html";
    }
  }

  const reg=document.getElementById("reg")
  reg.addEventListener("click",(e)=>{
    e.preventDefault()
    const freelancerData = {
        name: document.getElementById("fullName").value,
        phnum: document.getElementById("phone").value,
        // profilePicture: profilePictureName,  // Image as base64
        field: document.getElementById("fieldOfInterest").value,
        course: document.getElementById("course").value,
        skill: document.getElementById("skills").value,
        explvl: document.getElementById("experienceLevel").value,
        costr: document.getElementById("costRange").value,
        duration: document.getElementById("duration").value,
        pace: document.getElementById("learningPace").value,
        lang: document.getElementById("preferredLanguage").value,
        bio: document.getElementById("target").value
    }
    fetch("http://localhost:3001/fdetails",{
      method:"POST",
      headers:{
        "Content-Type":"application/json"
      },
      body:JSON.stringify(freelancerData)
    })
    .then(res=>{
      window.location="profile.html"
        return res.json()
    }).then(res=>{
        if(res.statusCode === 200){
            alert("Registered Successfully")
        }else{
            alert(res.msg)
        }
    })
  })