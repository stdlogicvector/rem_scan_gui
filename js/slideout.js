var slideouts = [];

function initSlideouts() {
    slideouts = document.querySelectorAll(".slideout");
    
    document.querySelectorAll(".slideout-tab").forEach((slideout) => {
        slideout.addEventListener("click", function(event) {

            event.target.parentNode.classList.toggle("show");
        });
    });
}
