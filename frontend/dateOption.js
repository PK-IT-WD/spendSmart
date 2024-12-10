const dateInput = document.getElementById('date');
const today = new Date();

const minDate = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate()).toISOString().split('T')[0];
const maxDate = today.toISOString().split('T')[0];

dateInput.addEventListener('change', () => {
    if (dateInput.value > maxDate) {
        alert('Future dates are not allowed');
        dateInput.value = maxDate;
    } 
    else if (dateInput.value < minDate) {
        alert('Above this dates are only allowed');
        dateInput.value = minDate;
    }
});